# Reclaim: Open With — V1.5 PRD

**Scope:** Expand to OAuth-based cloud services

**Prerequisite:** V1 complete (Google Workspace working)

---

## Overview

V1.5 extends the one-click export experience to cloud services that require OAuth or complex authentication. Users can configure API credentials to unlock support for Office 365, Box, Confluence, and other services.

## Goals

- Add support for 2+ additional cloud services (Office 365, Box, or Confluence)
- OAuth flow that completes successfully and stores tokens securely
- Token refresh works transparently (no re-auth needed for weeks)
- Settings page for managing connected services
- Same UX as V1: right-click → "Open in [App]" → file opens

## Non-Goals

- Content extraction from arbitrary pages — deferred to V2
- Bypassing view-only restrictions — deferred to V2
- Services without documented export APIs
- Auto-discovery of new services

---

## Candidate Services

| Service | Auth Method | Export Approach | Priority |
|---------|-------------|-----------------|----------|
| Office 365 / OneDrive | OAuth via Microsoft Graph API | `/drives/{id}/items/{id}/content` | High |
| Box | Session cookies (URLs expire in 15 min) | Direct download with `?download=1` | Medium |
| Confluence | Basic Auth or session cookie | PDF export via `flyingpdf` endpoint | Medium |
| Zoho Writer/Sheet | OAuth token | API download endpoint | Low |

### Office 365 / OneDrive

**URL Patterns:**
- `*.sharepoint.com/*`
- `onedrive.live.com/*`

**Auth Flow:**
1. User clicks "Connect Office 365" in settings
2. OAuth popup opens to Microsoft login
3. User grants permissions (Files.Read scope)
4. Extension receives access token + refresh token
5. Tokens stored in `chrome.storage.local`

**Export Flow:**
1. Detect SharePoint/OneDrive URL
2. Extract document ID from URL
3. Call Microsoft Graph API: `GET /drives/{driveId}/items/{itemId}/content`
4. API returns 302 redirect to pre-authenticated download URL
5. Download file, pass to native host

**Token Refresh:**
- Access tokens expire in ~1 hour
- Use refresh token to get new access token silently
- If refresh fails, prompt user to re-authenticate

### Box

**URL Patterns:**
- `app.box.com/file/*`
- `*.box.com/s/*` (shared links)

**Auth Approach:**
Box shared links include an auth token that expires in ~15 minutes. For owned files, we need OAuth.

**Export Flow (Shared Links):**
1. Detect Box shared link URL
2. Append `?download=1` or use `/shared/static/` pattern
3. Download immediately (before URL expires)
4. Pass to native host

**Export Flow (Owned Files):**
1. OAuth to Box API
2. Call `GET /files/{id}/content`
3. Follow redirect to download URL
4. Download and pass to native host

### Confluence

**URL Patterns:**
- `*.atlassian.net/wiki/*`
- Self-hosted Confluence instances

**Auth Approach:**
- Atlassian Cloud: OAuth 2.0 via Atlassian Connect
- Self-hosted: Basic Auth or session cookie

**Export Flow:**
1. Extract page ID from URL
2. Call `/wiki/spaces/flyingpdf/pdfpageexport.action?pageId={id}`
3. Follow redirect to PDF download
4. Pass to native host

---

## Extension Changes

### New Permissions

```json
{
  "host_permissions": [
    "https://docs.google.com/*",
    "https://*.sharepoint.com/*",
    "https://onedrive.live.com/*",
    "https://app.box.com/*",
    "https://*.box.com/*",
    "https://*.atlassian.net/*"
  ]
}
```

### Settings Page

New popup/options page for managing connected services:

```
┌─────────────────────────────────────────────┐
│  Reclaim: Open With — Settings          ✕   │
├─────────────────────────────────────────────┤
│                                             │
│  Connected Services                         │
│                                             │
│  ✅ Google Workspace          (built-in)    │
│                                             │
│  ☐ Office 365                 [Connect]     │
│     Microsoft Word, Excel, PowerPoint       │
│                                             │
│  ☐ Box                        [Connect]     │
│     File downloads                          │
│                                             │
│  ☐ Confluence                 [Connect]     │
│     PDF export                              │
│                                             │
└─────────────────────────────────────────────┘
```

### Token Storage

```typescript
interface StoredCredentials {
  service: 'office365' | 'box' | 'confluence' | 'zoho';
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;  // Unix timestamp
}

// Stored in chrome.storage.local
{
  "credentials": {
    "office365": { ... },
    "box": { ... }
  }
}
```

### Site Registry Extension

```typescript
interface SiteConfigV15 extends SiteConfig {
  authRequired: boolean;
  authService?: 'office365' | 'box' | 'confluence' | 'zoho';
  exportWithAuth: (id: string, token: string) => Promise<string>;  // Returns download URL
}
```

---

## OAuth Implementation

### Option A: Bring Your Own App (BYOA)

Users register their own OAuth apps with each provider and enter client ID/secret in extension settings.

**Pros:**
- No need to maintain OAuth apps for each provider
- Users control their own API access
- Works for enterprise environments with custom OAuth policies

**Cons:**
- Friction for non-technical users
- Each user needs to register apps

### Option B: Extension-Registered Apps

We register OAuth apps with Microsoft, Box, etc. and ship client IDs in the extension.

**Pros:**
- Zero-friction for users
- One-click connect

**Cons:**
- Must maintain app registrations
- Rate limits apply across all users
- Some enterprises block third-party OAuth apps

### Recommendation

**Hybrid approach:**
1. Ship with pre-registered apps for major providers (Office 365, Box)
2. Allow BYOA for users who need it (enterprise, self-hosted)
3. Settings page has "Use custom OAuth app" toggle per service

---

## Native Host Changes

No changes required for V1.5. The native host receives file paths and opens them — it doesn't care where the file came from.

---

## Security Considerations

- OAuth tokens stored in `chrome.storage.local` (encrypted by Chrome)
- Refresh tokens never sent to any server except the OAuth provider
- Clear tokens on extension uninstall
- HTTPS-only for all API calls
- Validate redirect URIs strictly

---

## Success Metrics

- OAuth flow completes successfully for supported services
- Token refresh works transparently (no re-auth needed for weeks)
- At least 2 additional services supported
- Same <3 second file open time as V1

---

## Open Questions

1. **BYOA vs pre-registered apps?** Recommend hybrid approach.
2. **Token expiration handling?** Silent refresh with fallback to re-auth prompt.
3. **Enterprise SSO?** Out of scope for V1.5 — users can use BYOA.
4. **Self-hosted Confluence?** Support via BYOA with custom domain input.
