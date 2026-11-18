# Sécurité

## Principes appliqués dans le code

| Exigence | Mise en œuvre |
|---|---|
| Ne jamais demander la clé privée principale | Seule `HL_API_WALLET_PRIVATE_KEY` (API wallet / agent) est lue ; avertissement si son adresse = compte principal |
| Pas de secrets dans le code | `.env` (git-ignoré), `.env.example` vide ; test `test_no_hardcoded_private_keys_in_source` |
| Jamais de clé dans les logs | `monitoring/logging_setup.py` masque les secrets configurés, toute chaîne de 64 hex et les jetons Telegram (testé) |
| Jamais de clé envoyée à un service d'IA | Aucun LLM n'est appelé par le système ; les décisions sont déterministes |
| Aucun retrait / transfert | `ExecutionClient` n'expose que ordres, annulations, levier ; test `test_sdk_exchange_object_has_no_withdraw_in_our_wrapper` |
| Permissions minimales | API wallet = signature d'ordres uniquement (ne peut pas retirer, docs Hyperliquid « API wallets ») |
| Vérifier l'état réel avant toute opération | pré-vol (compte à plat), confirmation des fills par `orderStatus` + position, réconciliation à chaque cycle |
| Kill switch fiable | état persistant écrit **avant** l'action ; HALT = plus d'entrées + annulation des ordres + politique `flatten`/`protect` ; reset CLI seulement |
| Dashboard | jeton Bearer (comparaison à temps constant), écoute sur 127.0.0.1, aucune route pour passer en LIVE ni modifier les limites |
| Telegram | liste blanche d'identifiants numériques, arrêt d'urgence en deux étapes, aucune commande de risque |
| Modèles ML | `joblib` = pickle : SHA-256 enregistré et vérifié avant chargement |

## Arrêt automatique (coupe-circuits)

HALT (kill switch) si : drawdown ≥ limite · données > 90 s · ≥ 5 coupures WebSocket en 10 min ·
≥ 6 échecs REST consécutifs · désynchronisation du compte · ≥ 3 erreurs d'exécution en 10 min ·
stop-loss impossible à installer · erreur critique d'exécution.
Blocage des entrées (sans HALT) si : perte journalière atteinte (jusqu'à 00:00 UTC), données > 30 s,
WebSocket déconnecté, compte non synchronisé depuis 120 s.

Note : le « dead man's switch » `scheduleCancel` d'Hyperliquid n'est **pas** utilisé, car il annule
**tous** les ordres, y compris les stop-loss. Les positions restent protégées par leur SL côté exchange
même si le programme s'arrête.

## Créer une API wallet (testnet puis mainnet)

1. Ouvrir l'application Hyperliquid (testnet : https://app.hyperliquid-testnet.xyz) avec le compte principal.
2. Menu **API** → générer une API wallet, lui donner un nom, l'autoriser (signature avec le compte principal).
3. Copier la clé privée de l'API wallet **une seule fois** dans `.env` (`HL_API_WALLET_PRIVATE_KEY`) ; mettre
   l'adresse publique du **compte principal** dans `HL_ACCOUNT_ADDRESS`.
4. Une API wallet par processus (les nonces sont suivis par signataire). Ne pas réutiliser une adresse
   d'API wallet révoquée (recommandation officielle : l'état des nonces peut être purgé).

## Révoquer une API wallet (procédure d'incident)

1. `python main.py kill-switch status` puis, si le système tourne, arrêt d'urgence (dashboard ou `/emergency_stop CONFIRM`).
2. Arrêter le processus (Ctrl+C / `docker compose down`). Les SL restent sur l'exchange.
3. Dans l'application Hyperliquid, menu **API** : supprimer/désautoriser l'API wallet. Alternative documentée :
   enregistrer une nouvelle API wallet non nommée **désenregistre** l'ancienne (doc « Nonces and API wallets »).
4. Supprimer la clé de `.env` et de toute sauvegarde ; vérifier qu'aucune copie n'existe (gestionnaire de mots de passe, historique shell).
5. Vérifier positions/ordres manuellement dans l'interface ; clôturer si nécessaire.
6. Si la machine est suspecte : changer aussi `DASHBOARD_TOKEN` et le jeton Telegram (`/revoke` dans @BotFather).

## Ce qui reste sous votre responsabilité

- La sécurité de la machine qui exécute le bot (mises à jour, disque chiffré, pare-feu).
- Ne jamais exposer le port du dashboard sur Internet sans tunnel/VPN et TLS.
- La conformité légale de votre utilisation (pays, fiscalité, conditions d'Hyperliquid).
