# Plan: Améliorer le PDF « Titre de congé »

## Résultat attendu
- Ajouter automatiquement le logo ERCM centré en haut de chaque titre de congé.
- Moderniser la présentation tout en conservant toutes les informations actuelles : titre, référence, employé, période, signatures et copies.
- Renforcer la hiérarchie visuelle avec un en-tête de marque, des sections mieux alignées, des séparateurs sobres et des espacements réguliers.

## Mise en œuvre
- Importer le logo ERCM existant dans le générateur PDF et le convertir en image compatible avec jsPDF au moment de la génération.
- Recomposer la page A4 dans `src/lib/titre-conge-pdf.ts` avec des marges cohérentes, un titre administratif clair, un bloc d'informations structuré et une zone de signatures équilibrée.
- Conserver les calculs, les données, le nom du fichier et le bouton de génération actuels sans modifier le fonctionnement des congés.

## Vérification
- Générer un PDF d'essai, le convertir en image et contrôler visuellement le logo, les alignements, les marges, la lisibilité et l'absence de contenu coupé.
- Corriger tout défaut observé puis refaire un contrôle final.
