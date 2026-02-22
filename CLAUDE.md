# Title4Pix - Guide de développement

## Description du projet

Application web permettant à un photographe de donner des titres et descriptifs à ses photos, assisté par l'IA (Claude). Le photographe enregistre sa voix, l'IA transcrit puis propose un titre et un descriptif adaptés à son style.

## Stack technique

- **Framework** : Next.js 15 (App Router, TypeScript)
- **UI** : shadcn/ui + Tailwind CSS 4
- **Base de données** : PostgreSQL + Prisma ORM
- **IA** : Anthropic Claude API (`@anthropic-ai/sdk`, modèle `claude-sonnet-4-6`)
- **Transcription vocale** : Web Speech API (navigateur natif)
- **Photos** : stockées sur le filesystem dans `/photos`
- **PDFs** : stockés dans `/uploads/pdfs` (max 5 fichiers)

## Architecture

### Structure des dossiers

```
title4pix/
├── photos/                       # photos du photographe (filesystem)
├── uploads/pdfs/                 # PDFs de contexte (max 5)
├── prisma/schema.prisma          # schéma BDD
├── src/
│   ├── app/
│   │   ├── page.tsx              # login
│   │   ├── photos/page.tsx       # viewer principal
│   │   ├── settings/page.tsx     # paramètres
│   │   ├── export/page.tsx       # export
│   │   └── api/
│   │       ├── auth/route.ts
│   │       ├── photos/route.ts
│   │       ├── photos/[filename]/route.ts
│   │       ├── generate/route.ts
│   │       ├── settings/route.ts
│   │       ├── pdfs/route.ts
│   │       └── export/route.ts
│   ├── components/
│   │   ├── ui/                   # shadcn
│   │   ├── photo-viewer.tsx
│   │   ├── photo-metadata.tsx
│   │   ├── voice-recorder.tsx
│   │   └── settings-form.tsx
│   ├── lib/
│   │   ├── prisma.ts             # singleton client Prisma
│   │   ├── claude.ts             # wrapper Anthropic SDK
│   │   ├── photos.ts             # scan filesystem + tri alphabétique
│   │   └── auth.ts               # vérification session/cookie
│   └── types/index.ts
```

### Schéma base de données

- **Photo** : filename (unique), title?, description?, transcription?, timestamps
- **Settings** : singleton (id=1), titleMinChars, titleMaxChars, descMinChars, descMaxChars, instructions, photographerUrl
- **PdfFile** : originalFilename, storedFilename, timestamps

### Pages et routes

| Route | Description |
|-------|-------------|
| `/` | Page de login (mot de passe simple) |
| `/photos` | Viewer principal : photo + navigation + métadonnées + enregistrement vocal |
| `/settings` | Paramètres : limites caractères, consignes IA, URL photographe, gestion PDFs |
| `/export` | Export fichier texte (nom_fichier, titre, descriptif) |

### Routes API

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/auth` | POST | Vérification mot de passe → cookie session |
| `/api/photos` | GET | Liste des photos (scan filesystem, tri alpha) |
| `/api/photos/[filename]` | GET | Métadonnées d'une photo |
| `/api/photos/[filename]` | PUT | Mise à jour titre/description/transcription |
| `/api/photos/[filename]/image` | GET | Servir l'image |
| `/api/generate` | POST | Transcription → Claude → titre + description |
| `/api/settings` | GET/PUT | Lecture/écriture des paramètres |
| `/api/pdfs` | GET/POST/DELETE | Gestion des PDFs (max 5) |
| `/api/export` | GET | Génération du fichier d'export |

## Flux IA (coeur du système)

### Transcription vocale
- **Technologie** : Web Speech API (SpeechRecognition) côté navigateur
- **Flux** : clic "Enregistrer" → écoute micro → transcription temps réel → texte affiché dans le champ "Enregistrement"
- **Langues** : français par défaut (`lang: "fr-FR"`)

### Génération titre et description
- **Modèle** : `claude-sonnet-4-6` (rapport qualité/prix optimal pour texte court)
- **Input** : image de la photo (vision, base64) + transcription vocale
- **Contexte** (system prompt) :
  - Consignes personnalisées du photographe (champ `instructions` des settings)
  - URL du site web du photographe (pour contexte style)
  - Contenu des PDFs uploadés (envoyés comme blocks `document` en base64)
  - Contraintes de longueur : titre [min-max] et description [min-max] caractères
- **Output** : JSON structuré `{ title: string, description: string }` via `output_config.format`
- **Optimisation** : prompt caching sur le system prompt (PDFs + consignes) pour réduire les coûts

### Construction du prompt

```
SYSTEM:
Tu es un assistant spécialisé dans la rédaction de titres et descriptifs pour des photographies d'art.

Contexte du photographe :
- Site web : {photographerUrl}
- {contenu des PDFs}

Consignes spécifiques :
{instructions}

Contraintes :
- Le titre doit contenir entre {titleMin} et {titleMax} caractères
- Le descriptif doit contenir entre {descMin} et {descMax} caractères

USER:
[Image de la photo en base64]
Transcription du photographe : "{transcription}"

Génère un titre et un descriptif pour cette photo.
```

### Coûts estimés
- ~$0.01-0.03 par photo avec Sonnet (image ~1000 tokens + texte court)
- Prompt caching réduit le coût du system prompt de ~90% après le premier appel

## Authentification

- Mot de passe stocké dans `.env.local` (`APP_PASSWORD`)
- Vérification simple → cookie httpOnly de session
- Middleware Next.js protège toutes les routes sauf `/` et `/api/auth`

## Conventions de code

- TypeScript strict
- Composants React : function components avec hooks
- Nommage fichiers : kebab-case
- API routes : Next.js App Router route handlers
- Imports : alias `@/` pour `src/`
- Pas de commentaires superflus, code auto-documenté
- Gestion d'erreurs : try/catch dans les API routes, toasts côté client

## Variables d'environnement (.env.local)

```
DATABASE_URL=postgresql://user:password@localhost:5432/title4pix
ANTHROPIC_API_KEY=sk-ant-...
APP_PASSWORD=changeme
```

## Commandes utiles

```bash
npm run dev              # Démarrer en développement
npx prisma migrate dev   # Appliquer les migrations
npx prisma studio        # Interface BDD
npx prisma generate      # Régénérer le client Prisma
```

## Plan de développement

### Phase 1 - Fondations
- Init Next.js + Tailwind + shadcn/ui
- Setup Prisma + PostgreSQL (schéma + migrations)
- Configuration .env.local

### Phase 2 - Authentification
- Page login (formulaire mot de passe)
- Middleware protection des routes
- API /api/auth

### Phase 3 - Viewer photos
- Lib scan filesystem photos + tri alphabétique
- API liste photos + servir images
- Composant viewer (affichage + navigation prev/next + champ numéro)

### Phase 4 - Métadonnées photos
- API CRUD métadonnées par filename
- Composant panneau droit (titre, description, enregistrement)
- Auto-save avec debounce

### Phase 5 - Enregistrement vocal + IA
- Composant voice-recorder (Web Speech API)
- Wrapper Claude SDK (construction prompt, appel API, structured output)
- API /api/generate (transcription → Claude → titre + description)
- Intégration flux complet

### Phase 6 - Paramètres
- API settings (GET/PUT singleton)
- API PDFs (upload max 5, suppression, liste)
- Page settings complète

### Phase 7 - Export
- API génération fichier texte
- Page export avec bouton téléchargement

### Phase 8 - Polish
- Gestion d'erreurs et toasts
- UX responsive
- Tests cas limites
