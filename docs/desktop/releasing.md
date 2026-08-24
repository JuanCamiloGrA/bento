# Release de escritorio

## Matriz soportada

Los sidecars PyInstaller se construyen en su sistema nativo; no se cruzan arquitecturas.

| Destino | Runner | Makers publicados |
| --- | --- | --- |
| Windows x64 | `windows-2025` | Squirrel `Setup.exe`, `.nupkg`, `RELEASES` |
| macOS x64 | `macos-15-intel` | `.dmg`, `.zip` |
| macOS arm64 | `macos-15` | `.dmg`, `.zip` |
| Ubuntu 22.04 x64 | `ubuntu-22.04` | `.deb`, `.zip` |

Cada fila usa Node 24 y Python 3.12, instala dependencias bloqueadas, ejecuta tests backend/web/desktop, construye el renderer y sidecar, ejecuta Forge `make`, abre dos veces el paquete nativo y verifica makers, ausencia de `.env` y URLs de desarrollo. Después lleva makers y SBOM a un staging plano, rechaza nombres colisionados y genera `SHA256SUMS` con los basenames finales descargables.

`desktop-native.yml` corre en PR/main sin secretos y publica artefactos marcados `unsigned` durante 14 días. No representan soporte de distribución ni deben renombrarse como release.

## Release firmado

Un tag `v*` activa `desktop-release.yml`. Antes de instalar o construir, cada fila exige que el tag sea exactamente `v` seguido de `apps/desktop/package.json#version`; por ejemplo, la versión `0.1.0` solo admite `v0.1.0`. El gate bloquea además el release completo si falta cualquier credencial obligatoria; no existe fallback silencioso a artefactos de producción sin firma.

Secrets requeridos:

- `APPLE_CERTIFICATE_BASE64`: PKCS#12 Developer ID Application en base64.
- `APPLE_CERTIFICATE_PASSWORD`.
- `APPLE_SIGNING_IDENTITY`.
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` para `notarytool`.
- `WINDOWS_CERTIFICATE_BASE64`: PFX de firma de código en base64.
- `WINDOWS_CERTIFICATE_PASSWORD`.

Los certificados se decodifican únicamente en el directorio temporal efímero del runner, nunca se suben como artefacto. macOS verifica `codesign`, Gatekeeper y el ticket grapado; Windows exige estado Authenticode `Valid`. La publicación recibe permisos de escritura solo después de que todas las filas terminen, adjunta procedencia de GitHub y crea el release desde el tag ya existente.

Actualmente no hay certificados ni cuentas de desarrollador en el repositorio. Hasta configurarlos como GitHub Actions secrets, los tags de producción quedan intencionalmente bloqueados. No se debe afirmar que un build local/PR está firmado o notarizado.

## Ejecución local

En el sistema destino:

```sh
make desktop-release-artifacts
```

Esto crea `dist/desktop/make`, ejecuta el smoke, genera `bento-sbom.cdx.json` y `SHA256SUMS`. Sin las variables `BENTO_MAC_SIGNING=1` o `BENTO_WINDOWS_SIGNING=1`, el resultado es explícitamente un build de prueba sin firma.

## Versiones y fuentes consultadas

- Electron `43.4.1`, Electron Forge `7.11.2`, PyInstaller `6.22.2`, uv `0.12.5`.
- Documentación oficial de Electron sobre distribución, firma, notarización y updates.
- Documentación oficial de Electron Forge de Packager/makers y firma.
- Documentación oficial de GitHub Actions sobre runners nativos, permisos mínimos, SHA completos y attestations.

Las actualizaciones automáticas no están habilitadas: Electron exige una cadena firmada y un mecanismo de rollback probado. Las actualizaciones se distribuyen como instaladores/releases manuales hasta que ese flujo tenga una implementación y pruebas específicas.
