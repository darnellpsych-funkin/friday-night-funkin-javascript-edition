# Friday Night Funkin' JavaScript Edition

Reconstrucción de Friday Night Funkin' en TypeScript, con PixiJS para el render y Web Audio para el sonido. Usa los assets de [Bambi-Slice Engine](https://github.com/darnellpsych-funkin/bambi-slice-engine).

Estado: prototipo temprano. Hoy carga a Boyfriend desde su atlas Sparrow y juega Bopeebo (normal): las notas caen contra el reloj del audio, se juzgan con las flechas y el personaje canta. Faltan notas largas, menús y compatibilidad con mods.

## Desarrollo

```
npm install
npm run dev     # servidor de desarrollo
npm run build   # typecheck + build en dist/
```

## Aviso

Este es un proyecto de fan y no es oficial. Friday Night Funkin' pertenece a The Funkin' Crew. Los assets de personajes provienen de Bambi-Slice y conservan sus licencias originales; el código de este repositorio se publica bajo la licencia del archivo LICENSE.
