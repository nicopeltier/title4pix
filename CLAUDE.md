# Title4Pix - Guide de développement

## Description du projet

Application web permettant à un photographe de donner des titres et descriptifs à ses photos, assisté par l'IA (Claude). Le photographe enregistre sa voix, l'IA transcrit puis propose un titre et un descriptif adaptés à son style.

## Stack technique

- **Framework** : Next.js 16.1.6 (App Router, TypeScript strict, React 19.2)
- **UI** : shadcn/ui (style "new-york") + Tailwind CSS 4 + Radix UI
- **Base de données** : PostgreSQL via Neon (Vercel Postgres) + Prisma 7.4 ORM avec adapter `@prisma/adapter-pg`
- **IA** : Anthropic Claude API (`@anthropic-ai/sdk` ^0.78.0, modèle `claude-sonnet-4-6`)
- **Transcription vocale** : Web Speech API (navigateur natif, Chrome/Edge uniquement)
- **Stockage fichiers** : Vercel Blob Storage (`@vercel/blob` ^2.3.0, accès **privé** avec URLs signées)
- **Export** : TSV natif + XLSX via librairie `xlsx` ^0.18.5
- **Notifications** : Sonner (toasts)
- **Icones** : Lucide React

## Hébergement et déploiement

- **Plateforme** : Vercel (plan Hobby)
- **Repo GitHub** : `nicopeltier/title4pix` (branche `main`)
- **Domaine** : `title4pix.paradigmchange.org` (CNAME Namecheap → `cname.vercel-dns.com`)
- **Base de données** : Neon Serverless Postgres (région Frankfurt, plan Free)
- **Stockage** : Vercel Blob (privé)
- **Déploiement** : automatique à chaque `git push` sur `main`

## Architecture

### Structure des dossiers

```
title4pix/
├── photos/                       # photos locales (git-ignored, pour upload initial)
├── uploads/pdfs/                 # PDFs locaux (git-ignored)
├── scripts/
│   └── upload-photos.ts          # script upload photos → Vercel Blob
├── prisma/
│   ├── schema.prisma             # schéma BDD (3 modèles)
│   ├── seed.ts                   # initialisation Settings singleton
│   └── migrations/               # migrations SQL
├── prisma.config.ts              # config Prisma (datasource, seed)
├── src/
│   ├── app/
│   │   ├── page.tsx              # login (page publique)
│   │   ├── layout.tsx            # layout racine (fonts Geist, Toaster, lang="fr")
│   │   ├── globals.css           # Tailwind 4 + variables oklch shadcn + dark mode
│   │   ├── photos/page.tsx       # viewer principal
│   │   ├── settings/page.tsx     # paramètres
│   │   ├── export/page.tsx       # export TSV/XLSX
│   │   └── api/
│   │       ├── auth/route.ts           # POST login, DELETE logout
│   │       ├── photos/route.ts         # GET liste photos (depuis Blob)
│   │       ├── photos/[filename]/
│   │       │   ├── route.ts            # GET/PUT métadonnées
│   │       │   └── image/route.ts      # GET image (redirect Blob signé)
│   │       ├── generate/route.ts       # POST transcription → Claude → titre+desc
│   │       ├── settings/route.ts       # GET/PUT settings singleton
│   │       ├── pdfs/route.ts           # GET/POST/DELETE PDFs (Blob + DB)
│   │       └── export/route.ts         # GET export TSV ou XLSX
│   ├── components/
│   │   ├── ui/                   # shadcn (button, card, input, label, progress, sonner, textarea)
│   │   ├── app-header.tsx        # navigation + logout
│   │   ├── photo-viewer.tsx      # affichage photo + navigation (clavier + boutons)
│   │   ├── photo-metadata.tsx    # édition titre/desc + compteurs caractères + voice
│   │   └── voice-recorder.tsx    # enregistrement vocal Web Speech API
│   ├── lib/
│   │   ├── prisma.ts             # singleton PrismaClient avec PrismaPg adapter
│   │   ├── claude.ts             # wrapper Anthropic SDK (structured output JSON)
│   │   ├── photos.ts             # lecture photos depuis Vercel Blob
│   │   ├── auth.ts               # gestion cookie session httpOnly
│   │   └── utils.ts              # cn() helper (clsx + tailwind-merge)
│   ├── middleware.ts             # protection routes (cookie t4p_session)
│   └── types/
│       └── speech.d.ts           # types Web Speech API
└── components.json               # config shadcn/ui
```

### Schéma base de données (Prisma)

```prisma
model Photo {
  id            Int      @id @default(autoincrement())
  filename      String   @unique       // nom du fichier image
  title         String?                // titre généré ou saisi
  description   String?                // descriptif généré ou saisi
  transcription String?                // transcription vocale brute
  inputTokens   Int      @default(0)   // tokens input Claude cumulés
  outputTokens  Int      @default(0)   // tokens output Claude cumulés
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model Settings {
  id              Int    @id @default(1) // singleton, toujours id=1
  titleMinChars   Int    @default(20)
  titleMaxChars   Int    @default(80)
  descMinChars    Int    @default(100)
  descMaxChars    Int    @default(500)
  instructions    String @default("")   // consignes IA personnalisées
  photographerUrl String @default("")   // URL site web du photographe
}

model PdfFile {
  id               Int      @id @default(autoincrement())
  originalFilename String                // nom affiché à l'utilisateur
  storedFilename   String   @unique      // UUID.pdf dans Blob
  createdAt        DateTime @default(now())
}
```

**Notes Prisma** :
- Le client est généré dans `src/generated/prisma` (git-ignored, regénéré au build)
- Utilise l'adapter `@prisma/adapter-pg` (pas le driver natif Prisma)
- Config dans `prisma.config.ts` (lit `DATABASE_URL` via dotenv)

### Stockage Vercel Blob (privé)

Tous les fichiers sont stockés en accès **privé**. Les URLs de téléchargement sont signées via `getDownloadUrl()`.

| Préfixe Blob | Contenu | Accès |
|---|---|---|
| `photos/{filename}` | Images des photos | Privé, URLs signées |
| `pdfs/{uuid}.pdf` | PDFs de contexte IA | Privé, URLs signées |

**Fonctions clés** (`src/lib/photos.ts`) :
- `getPhotoList()` : liste tous les blobs `photos/*`, retourne les filenames triés alphabétiquement
- `getPhotoBlobUrl(filename)` : retourne l'URL Blob brute d'une photo
- `getPhotoBuffer(filename)` : télécharge la photo via URL signée, retourne `{ buffer, mimeType }`
- `getMimeType(filename)` : déduit le MIME type depuis l'extension

### Routes API

| Route | Méthode | Description | Corps requête | Réponse |
|---|---|---|---|---|
| `/api/auth` | POST | Login | `{ password }` | `{ ok: true }` + cookie |
| `/api/auth` | DELETE | Logout | - | `{ ok: true }` |
| `/api/photos` | GET | Liste photos | - | `{ photos: [{index, filename, hasTitle, hasDescription}], total, totalInputTokens, totalOutputTokens }` |
| `/api/photos/[filename]` | GET | Métadonnées photo | - | `{ filename, title, description, transcription, inputTokens, outputTokens }` |
| `/api/photos/[filename]` | PUT | MAJ métadonnées | `{ title?, description?, transcription? }` | Métadonnées mises à jour (incluant `inputTokens`, `outputTokens`) |
| `/api/photos/[filename]/image` | GET | Servir image | - | Redirect → URL Blob signée |
| `/api/generate` | POST | Génération IA | `{ transcription, filename }` | `{ title, description, transcription, inputTokens, outputTokens }` |
| `/api/settings` | GET | Lire settings | - | Objet Settings |
| `/api/settings` | PUT | MAJ settings | Champs Settings partiels | Settings mis à jour |
| `/api/pdfs` | GET | Liste PDFs | - | `{ pdfs: PdfFile[] }` |
| `/api/pdfs` | POST | Upload PDF | FormData `file` | PdfFile créé (201) |
| `/api/pdfs` | DELETE | Supprimer PDF | `{ id }` | `{ ok: true }` |
| `/api/export` | GET | Export données | `?format=xlsx` optionnel | Fichier TSV ou XLSX |

### Pages et composants

| Page | Route | Composants utilisés |
|---|---|---|
| Login | `/` | Card, Input, Button, Label |
| Photos (viewer) | `/photos` | AppHeader, PhotoViewer, PhotoMetadata, Progress |
| Paramètres | `/settings` | AppHeader, Card, Input, Textarea, Button |
| Export | `/export` | AppHeader, Card, Button |

**Composants principaux** :

- **`PhotoViewer`** (`photos, currentIndex, onNavigate`) : affiche l'image courante, navigation prev/next par boutons et flèches clavier, saisie directe du numéro de photo
- **`PhotoMetadata`** (`filename`) : panneau d'édition titre/description avec compteurs de caractères (+ limites min/max depuis settings), affichage tokens et coût estimé en euros par photo, champ transcription en lecture seule, auto-save debounce 500ms, intègre VoiceRecorder
- **`VoiceRecorder`** (`onTranscription, disabled?`) : bouton enregistrement/arrêt, Web Speech API en `fr-FR` continu, affiche la transcription interim en italique
- **`AppHeader`** : barre de navigation (Photos, Paramètres, Export) + bouton déconnexion, highlight de la route active

## Flux IA (coeur du système)

### Transcription vocale
- **Technologie** : Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)
- **Navigateurs** : Chrome et Edge uniquement (message d'avertissement sinon)
- **Langue** : `fr-FR`, mode continu avec résultats intermédiaires
- **Flux** : clic "Enregistrer" → écoute micro → transcription temps réel → clic "Arrêter" → callback `onTranscription(text)`

### Génération titre et description (`src/lib/claude.ts`)

**Modèle** : `claude-sonnet-4-6` | **Max tokens** : 1024

**Input** (`GenerateInput`) :
```typescript
{
  imageBase64: string          // photo encodée base64
  imageMimeType: string        // "image/jpeg", "image/png", etc.
  transcription: string        // texte du photographe
  settings: {
    titleMinChars, titleMaxChars, descMinChars, descMaxChars: number
    instructions: string       // consignes libres
    photographerUrl: string    // URL site web
  }
  pdfContents: { filename: string; base64: string }[]  // PDFs contexte
}
```

**Output** (`GenerateOutput`) via `output_config.format` (JSON schema) :
```typescript
{ title: string, description: string, inputTokens: number, outputTokens: number }
```
Les champs `inputTokens` et `outputTokens` sont extraits de `response.usage` de l'API Anthropic.

**Construction du prompt** :
- **System** (avec `cache_control: ephemeral`) : rôle assistant photo, URL photographe, consignes, contraintes caractères
- **User** : PDFs comme blocks `document` (avec `cache_control: ephemeral`), image en block `image`, texte transcription

**Optimisations** :
- Prompt caching Anthropic sur le system prompt et les PDFs (~90% réduction après 1er appel)
- Coût estimé : ~$0.01-0.03 par photo

### Flux complet de génération (route `/api/generate`)
1. Valide `transcription` et `filename`
2. Charge les Settings depuis la BDD
3. Télécharge l'image depuis Vercel Blob → base64
4. Télécharge tous les PDFs depuis Vercel Blob → base64
5. Appelle `generateTitleAndDescription()` via Claude SDK
6. Sauvegarde titre + description + transcription en BDD (upsert), incrémente `inputTokens` et `outputTokens` de façon cumulative
7. Retourne le résultat au client (incluant `inputTokens` et `outputTokens` cumulés)

### Suivi des tokens et estimation des coûts

Chaque appel à Claude est tracé par photo via les champs `inputTokens` et `outputTokens` du modèle `Photo`. Les valeurs sont **cumulatives** : si on régénère le titre d'une photo, les tokens s'additionnent.

**Tarifs Claude Sonnet 4.6** : $3 / MTok input, $15 / MTok output

**Formule de coût estimé en euros** :
```
coût = (inputTokens × 3 + outputTokens × 15) / 1 000 000 × 0,92
```
Le taux EUR/USD de 0,92 est fixe (approximation).

**Affichage** :
- **Par photo** : sous le nom du fichier dans `PhotoMetadata`, affiche le nombre total de tokens et le coût estimé en euros
- **Global** : dans la page Paramètres, carte "Utilisation" avec tokens input/output séparés et coût total estimé

## Authentification

- **Mot de passe** : variable `APP_PASSWORD` dans les env vars Vercel
- **Cookie session** : `t4p_session`, httpOnly, SameSite=lax, Secure en production, expiration 7 jours
- **Token** : variable `SESSION_TOKEN` comparée à la valeur du cookie
- **Middleware** (`src/middleware.ts`) : protège toutes les routes sauf `/` et `/api/auth`
- **Logout** : `DELETE /api/auth` → supprime le cookie

## Variables d'environnement

### Production (Vercel)

| Variable | Source | Description |
|---|---|---|
| `DATABASE_URL` | Auto (Neon) | URL de connexion PostgreSQL poolée |
| `DATABASE_URL_UNPOOLED` | Auto (Neon) | URL non poolée (pour migrations) |
| `BLOB_READ_WRITE_TOKEN` | Auto (Vercel Blob) | Token d'accès au Blob Store |
| `ANTHROPIC_API_KEY` | Manuelle | Clé API Anthropic |
| `APP_PASSWORD` | Manuelle | Mot de passe de connexion |
| `SESSION_TOKEN` | Auto/Manuelle | Token de validation du cookie |
| `POSTGRES_*`, `PG*` | Auto (Neon) | Variables additionnelles Postgres |

### Développement local (`.env`)

```
DATABASE_URL=postgresql://user:password@localhost:5432/title4pix
ANTHROPIC_API_KEY=sk-ant-...
APP_PASSWORD=changeme
SESSION_TOKEN=un_token_secret
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...  # pour tester avec Blob en local
```

## Conventions de code

- TypeScript strict, pas de `any`
- Composants React : `"use client"` + function components avec hooks
- Nommage fichiers : kebab-case (`photo-viewer.tsx`)
- API routes : Next.js App Router route handlers (`route.ts`)
- Imports : alias `@/` pour `src/`
- Pas de commentaires superflus, code auto-documenté
- Gestion d'erreurs : try/catch dans les API routes, `toast.error()` / `toast.success()` côté client
- Auto-save : debounce 500ms via `useRef<ReturnType<typeof setTimeout>>`
- Composants shadcn dans `src/components/ui/` (ne pas modifier directement)

## Commandes utiles

```bash
# Développement
npm run dev                        # Démarrer en dev (localhost:3000)
npm run build                      # Build production (migrate deploy + generate + next build)
npm run lint                       # Linter ESLint

# Base de données
npx prisma migrate dev             # Créer/appliquer migrations en dev
npx prisma migrate deploy          # Appliquer migrations en production
npx prisma generate                # Régénérer le client Prisma
npx prisma studio                  # Interface BDD visuelle
npx tsx prisma/seed.ts             # Initialiser Settings singleton

# Vercel
vercel env pull .env.production.local  # Récupérer les env vars production
vercel --prod                          # Déployer manuellement

# Photos
npx tsx scripts/upload-photos.ts   # Uploader photos locales → Vercel Blob
                                   # (nécessite BLOB_READ_WRITE_TOKEN)

# Workflow quotidien
git add -A && git commit -m "description" && git push  # → auto-deploy Vercel
```

## Contraintes structurelles pour les développements futurs

### Vercel Serverless
- **Pas de filesystem persistant** : tout fichier doit être lu/écrit via Vercel Blob, pas `fs`
- **Timeout** : 10s par défaut sur les fonctions serverless (plan Hobby). La génération IA peut approcher cette limite avec de gros PDFs
- **Cold starts** : la première requête après inactivité peut être plus lente

### Vercel Blob (privé)
- Toujours utiliser `access: "private"` dans les appels `put()`
- Toujours utiliser `getDownloadUrl(url)` pour obtenir une URL signée avant de `fetch()` un blob
- La fonction `list()` pagine par 1000 (utiliser `cursor` pour les grandes listes)

### Prisma / Neon
- Le client Prisma est généré dans `src/generated/prisma` (git-ignored)
- Utilise l'adapter PrismaPg, pas le driver natif : `new PrismaClient({ adapter })`
- Le singleton global empêche les connexions multiples en dev
- Settings est un singleton (toujours `id: 1`), utiliser `upsert` pour les mises à jour

### Web Speech API
- Fonctionne **uniquement** dans Chrome et Edge (pas Firefox, pas Safari)
- Nécessite HTTPS en production (OK avec Vercel)
- Types déclarés dans `src/types/speech.d.ts`

### Ajout de nouvelles photos
- Placer les images dans `/photos/` localement
- Exécuter `npx tsx scripts/upload-photos.ts` (avec `BLOB_READ_WRITE_TOKEN`)
- Le script est incrémental : il ne ré-uploade pas les photos déjà présentes
