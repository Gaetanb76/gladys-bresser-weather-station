# Station météo Bresser pour Gladys Assistant

Intègre votre **station WiFi couleur Bresser 7002580 (5-en-1)** dans Gladys Assistant, avec un widget de phase de lune.

## Fonctionnalités

- Température, humidité et point de rosée extérieurs
- Température et humidité intérieures
- Pression atmosphérique
- Vitesse, rafales et direction du vent
- Pluie (dernière heure, cumul du jour)
- Widget : phase de la lune + graphique d'illumination sur 30 jours (calcul local)

Le protocole d'envoi de la station **ne contient pas l'état des piles** : aucune entité batterie n'est fournie.

## Fonctionnement

La console ne sait envoyer ses données qu'à Weather Underground (HTTP) ou Weathercloud. L'intégration lance un conteneur qui comprend le protocole Weather Underground. Un petit relais sur votre réseau (par ex. un Raspberry Pi avec dnsmasq + nginx, voir le dossier `relay/` du dépôt) redirige `rtupdate.wunderground.com` et envoie une copie de chaque envoi à ce conteneur. Votre page Wunderground continue de fonctionner.

## Mise en place

1. Installez l'intégration dans Gladys ; notez l'adresse/le port affichés dans Configuration.
2. Installez le relais (`relay/README.md`).
3. Vérifiez que la station envoie vers Weather Underground (page Pro Weather Link, `http://192.168.1.1` une fois connecté au WiFi `PWS-xxxxxx`).
4. Dans l'onglet Découverte, créez l'appareil « Station météo Bresser ».
5. Ajoutez le widget **Phase de la lune** à un tableau de bord.

## Dépannage

- Pas de données : testez le relais (`curl` dans `relay/README.md`) et vérifiez que le Pi est bien le DNS de la station.
- La pression est la valeur de la station convertie depuis inHg.
- « Pluie (dernière heure) » correspond à `rainin` envoyé par la station.
