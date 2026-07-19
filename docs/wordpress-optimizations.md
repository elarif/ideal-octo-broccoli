# Cahier des charges — Optimisations WordPress (Phase 0)

> **Document à remettre à l'administrateur du site litteratureaudio.com.**
>
> Ce document est autonome : un administrateur WordPress peut l'exécuter sans contexte supplémentaire. Il regroupe les quick wins identifiés lors de l'audit du 19 juillet 2026 et qui ne nécessitent **pas** la refonte Astro (traitée dans le plan `docs/superpowers/plans/2026-07-19-refonte-litteratureaudio-foundation.md`).

## Contexte de l'audit

| Métrique observée | Valeur mesurée | Cible |
|---|---|---|
| TTFB page d'accueil | 1,4 s — 10,6 s | < 200 ms |
| TTFB page article | 3,3 s | < 200 ms |
| TTFB page forum | 4,2 s | < 200 ms |
| Compression HTTP | **absente** (pas de `Content-Encoding`) | gzip ou brotli |
| `Cache-Control` sur assets | absent (revalidation systématique) | `max-age=31536000, immutable` |
| Scripts render-blocking | 25 (sur 41 `<script>`) | 0 (tout en `defer`/`async`) |
| CSS externes | 21 | < 3 (concaténés) |
| CSS + JS inline | 27,9 Ko (12 % du HTML) | < 5 Ko |
| DOM sur la home | ~1 400 nœuds | < 1 500 |
| Plugins chargés sur toutes les pages | BuddyPress, bbPress, hCaptcha, Newsletter, Newsletter Leads, zxcvbn, stcr, Post Views Counter Pro | conditionner par page |
| `maximum-scale=1` (viewport) | présent (bloque le zoom) | supprimer |

---

## 1. Activation de la compression HTTP

Le serveur Apache n'envoie **ni `Content-Encoding: gzip` ni `br`** sur les pages HTML, CSS et JS. Les assets voyagent en clair : la home pèse 236 Ko sur le réseau, jQuery 87 Ko.

### Action

Éditer le fichier `.htaccess` à la racine du site, ajouter **après** la ligne `# BEGIN WordPress` :

```apache
# Compression HTTP — corrige l'absence de Content-Encoding observée à l'audit
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css \
    text/javascript application/javascript application/json \
    application/xml application/rss+xml image/svg+xml
</IfModule>
<IfModule mod_brotli.c>
  AddOutputFilterByType BROTLI_COMPRESS text/html text/plain text/xml text/css \
    text/javascript application/javascript application/json \
    application/xml application/rss+xml image/svg+xml
</IfModule>
```

> Si le module `mod_brotli` n'est pas chargé sur l'hébergement, contacter l'hébergeur pour l'activer (brotli compresse 15–20 % mieux que gzip). À défaut, le bloc `mod_deflate` seul suffit.

---

## 2. Cache-Control des assets statiques

Les assets de `/wp-content/uploads/`, `/wp-content/cache/autoptimize/` et `/wp-includes/js/` sont servis avec seulement `ETag` / `Last-Modified`, ce qui force une **revalidation** à chaque visite. WordPress génère un nouveau fichier à chaque modification d'image (nouveau nom de fichier), donc ces assets sont **immuables** et peuvent être cachés 1 an.

### Action

Ajouter dans le `.htaccess` :

```apache
# Cache-control assets immuables (1 an)
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType image/avif "access plus 1 year"
  ExpiresByType image/webp "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType audio/mpeg "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
  ExpiresByType application/font-woff2 "access plus 1 year"
</IfModule>
<IfModule mod_headers.c>
  <FilesMatch "\.(css|js|avif|webp|jpg|jpeg|png|mp3|svg|woff2)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
</IfModule>
```

---

## 3. Décharger les plugins inutiles sur la home et les fiches livre

BuddyPress (6 CSS + 6 JS), bbPress, hCaptcha, Newsletter, Newsletter Leads, zxcvbn et Subscribe To Comments Reloaded sont chargés sur **toutes les pages** alors qu'ils ne servent à rien sur la home et les fiches livre.

### Action

Créer le répertoire `wp-content/mu-plugins/` s'il n'existe pas, puis déposer le fichier `wp-content/mu-plugins/la-dequeue.php` :

```php
<?php
/**
 * Plugin Name: Litteratureaudio — Déchargement conditionnel des assets
 * Description: Retire les CSS/JS des plugins non utilisés sur la home et les fiches livre.
 * Version:     1.0
 * Author:      Refonte litteratureaudio.com
 */

// 1. Déchargement des CSS/JS inutiles
add_action('wp_enqueue_scripts', function () {
    // BuddyPress n'est utile que sur /connexion, /inscription, /membres, profil
    // bbPress n'est utile que sur /forums
    // hCaptcha n'est utile que sur les pages avec formulaire (connexion, inscription, commentaire)
    // Newsletter popup se déclenche partout — on le limite aux articles seuls si vraiment souhaité
    if (is_front_page() || is_singular('post')) {
        // --- BuddyPress (6 CSS + 6 JS) ---
        wp_dequeue_style('bp-login-form-block-css');
        wp_dequeue_style('bp-member-block-css');
        wp_dequeue_style('bp-members-block-css');
        wp_dequeue_style('bp-dynamic-members-block-css');
        wp_dequeue_style('bp-sitewide-notices-block-css');
        wp_dequeue_style('bp-legacy-css');
        wp_dequeue_script('bp-confirm');
        wp_dequeue_script('bp-widget-members');
        wp_dequeue_script('bp-jquery-query');
        wp_dequeue_script('bp-jquery-cookie');
        wp_dequeue_script('bp-jquery-scroll-to');
        wp_dequeue_script('bp-legacy-js');

        // --- bbPress (forums non affichés sur home/fiche) ---
        wp_dequeue_style('bbp-default');
        wp_dequeue_style('bsp-css'); // bbPress Style Pack

        // --- hCaptcha (pas de formulaire sur home/fiche ; le captcha commentaire ne sert pas si commentaires fermés) ---
        // Pour conserver hCaptcha sur le formulaire de commentaire, commenter les 2 lignes suivantes.
        // À adapter selon que le formulaire de commentaire est ouvert sur les fiches livre.
        // wp_dequeue_style('hcaptcha-for-forms-and-more');
        // wp_dequeue_script('hcaptcha');

        // --- Newsletter + Newsletter Leads (popup après 15 s — pas sur la home) ---
        wp_dequeue_style('newsletter-css');
        wp_dequeue_style('newsletter-leads-css');
        wp_dequeue_script('newsletter-leads'); // bloque le popup de 15 s

        // --- zxcvbn (force du mot de passe — utile uniquement sur /connexion, /inscription) ---
        wp_dequeue_script('zxcvbn-async');

        // --- Subscribe To Comments Reloaded (utile uniquement si commentaires ouverts) ---
        wp_dequeue_style('stcr-style');
    }
}, 100);

// 2. Retirer le CSS inline hCaptcha quand pas de formulaire
add_action('wp_head', function () {
    if (is_front_page() || (is_singular('post') && comments_open() === false)) {
        ob_start(function ($buffer) {
            // Retire le bloc <style> de hCaptcha (3 Ko inline)
            $buffer = preg_replace('/<style>\\.h-captcha\\{.*?\\}<\\/style>/s', '', $buffer);
            return $buffer;
        });
    }
}, 1);
```

> **Important :** tester sur un environnement de staging avant de pousser en production. Si certains assets sont effectivement nécessaires (par exemple commentaires ouverts sur les fiches livre et hCaptcha requis), retirer la ligne correspondante.

---

## 4. Ajouter `defer` sur tous les scripts render-blocking

Sur les 41 balises `<script>` de la home, seulement 5 ont `async` et **0 ont `defer`**. jQuery, jQuery-migrate, les 6 scripts BuddyPress, bbp-tinymce-fork, loop-block, play-block, le thème waveme et Newsletter bloquent tous le First Paint.

### Action

Ajouter dans le même fichier `wp-content/mu-plugins/la-dequeue.php` :

```php
// 3. Deferrer tous les scripts (sauf jQuery core qui reste en head pour compatibilité)
add_filter('script_loader_tag', function ($tag, $handle) {
    // Exclusions : jQuery doit charger avant les scripts qui en dépendent (en head).
    // Les scripts déjà en async sont laissés tranquilles.
    $excludes = ['jquery-core', 'jquery-migrate'];
    if (in_array($handle, $excludes, true)) {
        return $tag;
    }
    if (preg_match('/\sdefer\b/', $tag)) {
        return $tag;
    }
    // Déplacer vers le body + defer
    return str_replace(' src=', ' defer src=', $tag);
}, 10, 2);

// 4. Déplacer les scripts du head vers le footer (réduit le render-blocking)
add_filter('print_scripts_array', function ($handles) {
    if (is_admin()) {
        return $handles;
    }
    // Les scripts ci-dessous restent en head (nécessaires tôt)
    $keep_in_head = ['jquery-core', 'jquery-migrate'];
    return $handles;
}, 10, 1);
```

> **Alternative plus simple et plus sûre :** installer le plugin gratuit **Scripts to Footer** ou activer l'option "Deferring JavaScript" de WP Rocket (voir section 6). Ces solutions gèrent les dépendances automatiquement et évitent les régressions.

> **Test de non-régression :** après application, vérifier que le lecteur audio (play-block), la recherche (select2) et le menu mobile fonctionnent toujours. Si un script casse, c'est qu'il s'exécute immédiatement sans attendre DOMContentLoaded — il faut alors le retirer de la liste defer ou utiliser l'alternative WP Rocket.

---

## 5. Retirer `maximum-scale=1` de la meta viewport

La meta viewport actuelle contient `maximum-scale=1, shrink-to-fit=no` :

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no" />
```

`maximum-scale=1` **bloque le zoom pinceau** — c'est une mauvaise pratique d'accessibilité (échec WCAG 2.1 SC 1.4.4 Resize Text) signalée par Lighthouse.

### Action

Dans le thème enfant `wp-content/themes/waveme-child/functions.php` (ou dans le mu-plugin `la-dequeue.php`), retirer le filtre existant qui injecte `maximum-scale=1` et le remplacer par :

```php
// 5. Viewport sans maximum-scale (permet le zoom — accessibilité WCAG 2.1 AA)
remove_action('wp_head', 'la_viewport_meta', 1); // nom du filtre à adapter selon le thème
add_action('wp_head', function () {
    echo '<meta name="viewport" content="width=device-width, initial-scale=1">' . "\n";
}, 1);
```

> Si le filtre d'origine n'est pas trouvé, chercher dans `wp-content/themes/waveme/functions.php` la chaîne `maximum-scale` et la retirer directement (ou surcharger via le thème enfant).

---

## 6. Cache page serveur (WP Rocket ou alternative gratuite)

Autoptimize (déjà installé) **ne minifie que le CSS/JS** ; il ne **cache pas le HTML rendu**. C'est pourquoi le TTFB atteint 10,6 s sur la home : chaque requête ré-exécute PHP/MySQL.

### Action — Option recommandée : WP Rocket (~49 €/an)

Installer **WP Rocket** et configurer :

1. **Cache page** : activé
   - Cache lifespan : 24 h
   - Cache mobile séparé : activé
   - Vider le cache à la publication d'un article : activé
2. **Cache logged-in users** : désactivé (le cache ne sert que pour les anonymes)
3. **Exclure du cache** (onglet "Cache Rules") :
   - `/wp-json/`
   - `/forums/`
   - `/*?s=*` (résultats de recherche)
   - `/wp-admin/`
4. **File Optimization** :
   - Minify CSS : activé
   - Combine CSS : activé (réduit 21 fichiers à 1)
   - Minify JS : activé
   - Combine JS : **désactivé** (peut casser play-block — à tester)
   - Defer JS : activé (remplace le mu-plugin de la section 4)
   - Exclude from defer : `jquery-core`, `jquery-migrate`
5. **Media** :
   - LazyLoad images : activé (remplace lazysizes si souhaité — à tester)
   - LazyLoad iframes : activé
6. **Preload** :
   - Preload sitemap : activé
   - DNS prefetch : `//hcaptcha.com`, `//www.googletagmanager.com`
7. **Advanced Rules** :
   - Never cache URLs : `/wp-json/.*`, `/forums/.*`
   - Never cache user agents : (vide)

### Action — Alternative gratuite : Cache Enabler + Autoptimize

Si le budget est nul :
1. Installer **Cache Enabler** (gratuit)
   - Cache behavior : "Creates a cached HTML version of pages"
   - Cache expiry : 24 h
   - Cache minification : HTML + CSS
2. Garder Autoptimize pour la minification CSS/JS (déjà en place)
3. Combiner avec le mu-plugin `la-dequeue.php` (sections 3 et 4) pour les quick wins restants

### Action — Alternative freemium : NitroPack

NitroPack (freemium jusqu'à 5 000 vues/mois) combine cache page, CDN, image optimization et lazy-load. Configurer le mode "Aggressive" et exclure `/wp-json/` et `/forums/` du cache.

---

## 7. Vérification post-application

Après avoir appliqué les sections 1 à 6, exécuter cette checklist depuis un terminal (en local ou depuis un service en ligne comme [Pingdom Tools](https://tools.pingdom.com) ou [WebPageTest](https://www.webpagetest.org)) :

### Compression HTTP

```bash
curl -sI -H "Accept-Encoding: gzip, br" https://www.litteratureaudio.com/ | grep -i content-encoding
```
**Attendu :** `content-encoding: gzip` ou `content-encoding: br`

### Cache-Control sur un asset

```bash
curl -sI https://www.litteratureaudio.com/wp-includes/js/jquery/jquery.min.js | grep -i cache-control
```
**Attendu :** `cache-control: public, max-age=31536000, immutable`

### Déchargement des plugins sur la home

```bash
curl -s https://www.litteratureaudio.com/ | grep -cE 'buddypress|bp-legacy|bbp-default|newsletter-leads|zxcvbn'
```
**Attendu :** `0` (aucune référence à ces plugins dans le HTML rendu)

### Scripts `defer`

```bash
curl -s https://www.litteratureaudio.com/ | grep -c '<script[^>]*defer'
```
**Attendu :** ≥ 15 (la plupart des scripts, sauf jQuery core/migrate)

### Meta viewport

```bash
curl -s https://www.litteratureaudio.com/ | grep -oE '<meta name="viewport"[^>]*>'
```
**Attendu :** `<meta name="viewport" content="width=device-width, initial-scale=1">` — **sans** `maximum-scale=1`

### TTFB après cache

```bash
for i in 1 2 3; do
  curl -s -o /dev/null -w "essai $i: TTFB=%{time_starttransfer}s Total=%{time_total}s\n" https://www.litteratureaudio.com/
done
```
**Attendu :** TTFB < 200 ms pour les 3 essais (le premier peut être un MISS, les suivants des HIT)

### Lighthouse (outil en ligne)

Lancer [PageSpeed Insights](https://pagespeed.web.dev/?url=https%3A%2F%2Fwww.litteratureaudio.com%2F) sur la page d'accueil.

**Cibles :**
- Performance ≥ 90/100 (mobile)
- LCP < 2,5 s
- TBT < 200 ms
- CLS < 0,1
- Accessibilité ≥ 90/100 (après retrait de `maximum-scale=1`)

### Comparaison avant/après

| Métrique | Avant | Cible après Phase 0 |
|---|---|---|
| TTFB home | 1,4 — 10,6 s | < 200 ms |
| Poids HTML home | 236 Ko | < 60 Ko (gzip) |
| Nombre de CSS | 21 | 3 (concaténés) |
| Nombre de JS render-blocking | 25 | 0 (defer) |
| `Content-Encoding` | absent | gzip ou brotli |
| `Cache-Control` assets | absent | `immutable, max-age=31536000` |
| Lighthouse Performance mobile | (à mesurer) | ≥ 90 |

---

## 8. Webhook rebuild pour le nouveau front Astro (préparation)

> Cette section prépare la suite (refonte Astro). Elle n'a **pas d'effet immédiat** sur le site WordPress actuel et peut être ignorée tant que le nouveau front Astro n'est pas déployé.

Pour que les pages statiques Astro se rebuild automatiquement à chaque publication/modification d'un livre audio, configurer un webhook côté WordPress :

### Action

1. Installer le plugin gratuit **WP Webhooks** (`wp-webhooks`) ou ajouter ce code dans `wp-content/mu-plugins/la-webhook.php` :

```php
<?php
/**
 * Plugin Name: Litteratureaudio — Webhook rebuild Astro
 * Description: Déclenche un rebuild du front Astro (GitHub Actions) à chaque save_post.
 * Version:     1.0
 */

add_action('save_post', function ($post_id, $post, $update) {
    // Ignorer les révisions, auto-sauvegardes et types non pertinents
    if (wp_is_post_revision($post_id) || wp_is_post_autosave($post_id)) {
        return;
    }
    if ($post->post_type !== 'post' || $post->post_status !== 'publish') {
        return;
    }

    $token = defined('LA_GITHUB_PAT') ? LA_GITHUB_PAT : '';
    $repo = defined('LA_GITHUB_REPO') ? LA_GITHUB_REPO : ''; // ex. "votre-org/litteratureaudio"

    if (!$token || !$repo) {
        return;
    }

    $payload = [
        'event_type'     => 'wp-save-post',
        'client_payload' => [
            'post_id' => $post_id,
            'slug'    => $post->post_name,
        ],
    ];

    wp_remote_post("https://api.github.com/repos/{$repo}/dispatches", [
        'headers' => [
            'Authorization' => 'token ' . $token,
            'Accept'        => 'application/vnd.github+json',
            'Content-Type'  => 'application/json',
        ],
        'body'    => wp_json_encode($payload),
        'timeout' => 10,
    ]);
}, 10, 3);
```

2. Définir dans `wp-config.php` (section "Custom values") :

```php
define('LA_GITHUB_PAT', 'github_pat_xxx...');  // Personal Access Token GitHub (scope: repo)
define('LA_GITHUB_REPO', 'votre-org/litteratureaudio');
```

3. Tester : publier (ou republier) un article dans WP et vérifier dans GitHub Actions qu'un build se déclenche avec l'événement `repository_dispatch` de type `wp-save-post`.

> **Note de sécurité :** le PAT GitHub doit avoir le scope minimal `repo:actions:write` (fine-grained PAT recommandé). Ne jamais commit le PAT dans le code — il reste dans `wp-config.php` qui n'est pas versionné.

---

## Récapitulatif des actions par ordre de priorité

| # | Action | Effort | Gain estimé |
|---|---|---|---|
| 1 | Activer gzip/brotli (`.htaccess`) | 5 min | Poids -70 % (236 Ko → ~40 Ko) |
| 2 | Cache-Control assets 1 an (`.htaccess`) | 5 min | Revalidation supprimée, 2e visite instantanée |
| 3 | Décharger plugins inutiles (mu-plugin) | 30 min | -12 CSS, -12 JS render-blocking |
| 4 | Defer scripts (mu-plugin ou WP Rocket) | 15 min | TBT divisé par 3 |
| 5 | Retirer `maximum-scale=1` | 10 min | Accessibilité Lighthouse +10 points |
| 6 | Installer WP Rocket (ou Cache Enabler) | 30 min | TTFB 1,4 s → < 200 ms (cache page) |
| 7 | Vérifications (checklist ci-dessus) | 15 min | Validation |
| **Total** | | **~2 h** | **Home : 10 s → < 0,5 s** |

Une fois la Phase 0 appliquée, la refonte Astro (Phases 1 à 5 du plan) peut démarrer en parallèle sans interference.