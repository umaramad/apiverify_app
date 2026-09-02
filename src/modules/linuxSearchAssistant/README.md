# Linux Search Assistant (module)

Independent, feature-flagged module for APIVerify. Does **not** modify existing feature screens.

## Folder structure

```
src/modules/linuxSearchAssistant/
├── README.md                 # this file
├── index.ts                  # public module surface (flag + page id + registration helpers)
├── featureFlag.ts            # enable/disable (env + persisted setting)
├── models/                   # DTOs / types only
├── services/                 # pure search logic (no Electron / no React)
├── data/                     # offline command catalog
├── ipc/                      # module-owned IPC channel names
├── main/                     # main-process service + handler registration
├── renderer/
│   ├── pages/                # page shell mounted via PageRouter
│   ├── components/           # module UI only
│   └── hooks/                # module hooks only
└── tests/                    # unit tests for services
```

## Integration points (minimal)

| Location | Change |
|----------|--------|
| `ActivePage` union | add `linuxSearchAssistant` |
| `AppSidebar` | one menu item, **only if feature flag enabled** |
| `PageRouter` | lazy import of module page |
| `AppHeader` | page title |
| IPC allow-list / preload | module channels only |
| Settings | optional toggle to enable/disable module |

All search UI, models, and services live under this folder.

## Configuration models

Portable target configuration lives in `models/config.ts` only (no UI).

Stored fields: environment, application name, server name, host/IP, SSH port,
username, application home, log/config/search path lists.

Explicitly excluded: passwords, SSH keys, private key paths, tokens.

## SSH service

Main-process `SshService` (`main/sshService.ts`):

- Password authentication only (prompt injected; never stored/cached/logged)
- One live session per server id, kept alive while the app runs
- Public API: `connect`, `disconnect`, `executePredefined`, `isConnected`, `closeAll`
- `executePredefined` accepts allowlisted operations only (no arbitrary shell)

## SessionManager

`main/sessionManager.ts` owns session **handles** (never passwords):

- Reuses one active session per server
- Returns `SshSessionHandle` objects only
- Broadcasts `linuxSearchAssistant:sessionExpired` so the UI can prompt reconnect
- `closeAll()` on window close; `closeAllAndShutdown()` on app exit
