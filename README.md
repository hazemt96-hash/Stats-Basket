# Stats Basket

Appli de saisie de stats de basket, installable sur iPhone, qui fonctionne sans réseau. Les données restent sur le téléphone.

## Mise en ligne gratuite (GitHub Pages)

1. Crée un compte sur github.com, puis un dépôt public nommé `stats-basket`.
2. Sur la page du dépôt : **Add file > Upload files**, dépose tous les fichiers de ce dossier (pas le dossier lui-même), puis **Commit changes**.
3. **Settings > Pages** : dans *Branch*, choisis `main`, dossier `/ (root)`, puis **Save**.
4. Après une ou deux minutes, l'adresse apparaît en haut de cette page : `https://TON-PSEUDO.github.io/stats-basket/`.

## Installation sur l'iPhone

1. Ouvre l'adresse dans **Safari**.
2. Touche **Partager**, puis **Sur l'écran d'accueil**.
3. Ouvre toujours l'appli depuis cette icône : Safari et l'icône ne partagent pas les mêmes données.
4. Ouvre-la une fois avec du réseau pour qu'elle se mette en mémoire. Ensuite, elle marche sans réseau.

## Modifier l'appli

Le code se trouve dans `app.js` (logique et écrans) et `style.css` (apparence). VS Code convient très bien.

Après une modification, envoie les fichiers sur GitHub et **augmente le numéro de version dans `sw.js`** (`stats-basket-v1`, puis `v2`, etc.), sinon l'iPhone garde l'ancienne version. Ferme puis rouvre l'appli pour récupérer la mise à jour.

## Sécurité des données

Les données ne sont que sur ce téléphone. Utilise régulièrement **Sauvegarder** sur l'écran d'accueil de l'appli et garde le fichier dans Fichiers ou iCloud. **Restaurer** remet tout en place, y compris sur un nouveau téléphone.
