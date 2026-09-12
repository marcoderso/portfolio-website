# Persönliche linke Tischseite

Rein atmosphärische Ergänzung ohne neue Klickflächen oder Inhaltsverknüpfungen:

- Bernsteinfarbener Pressglas-Aschenbecher: 32 weichere Rippen, vier Ablagerillen, flacher Bodenschliff und etwas Asche. Die komplexe Glaswirkung ist als Cycles-COMBINED-Textur auf die echte 3D-Schale gebacken. Eine unbeleuchtete Web-Darstellung erhält Bernsteinfarbe und Glanzreflexe. Einschränkung: Reflexionen und Brechung sind vorberechnet, nicht kameraabhängig; die Geometrie bleibt vollständig dreidimensional.
- Eine glimmende Zigarette mit schmalem, langsam aufsteigendem Shader-Rauch. Bei `prefers-reduced-motion` bleibt die Glut konstant und der Rauch ausgeblendet; unsichtbare Tabs pausieren die Animation.
- Leicht eingedrückte rot-weiße Marlboro-Packung mit separatem Klappdeckel, Folienkante und modellierter Beschriftung. Annäherung, kein Scan einer konkreten Packung.
- Fünf unterschiedlich große, unregelmäßig versetzte Bücher mit unbeschrifteten Einbänden und abgenutzten Kanten.
- Dünnes Reclam-Taschenbuch mit dem bereitgestellten, materialseitig abgedunkelten Cover, separatem Seitenblock, Rückenfalz, leicht gewölbter Ecke und Papierlesezeichen. Es steht bei 65° auf dem Tisch und lehnt physisch an der Vorderkante des obersten Buchs.
- Anordnung: Aschenbecher vorne links, Packung links daneben, Bücherstapel dahinter. Stapel und Borges-Buch sind gegenüber v2 gemeinsam um 0,38 Modell-Einheiten nach hinten versetzt; ihre Auflage bleibt erhalten. Monitor- und Disketten-Fokus bleiben unverändert.

## Integration

`src/Application/World/PersonalDesk.ts` lädt `static/models/PersonalDesk/personal_desk.glb` und ergänzt Rauch. Modellkoordinaten entsprechen dem Robotron; Web-Skalierung ist 900. Der Marker `CigaretteSmokeOrigin` legt den Rauchursprung fest. Alle Teile sind nach Material zusammengefasst (18 Mesh-Batches). Die Glastextur ist im GLB eingebettet; die zusätzliche Cubemap-Aufnahme entfällt. `AmberGlassBaked` wird als MeshBasicMaterial mit der exportierten Emissionstextur dargestellt, ohne erneute Beleuchtung.

`Decor.ts` blendet die bisherigen losen Papiere, beide Papierstapel und deren Halter aus; die Originaldatei bleibt erhalten. `sources.ts` verwendet `baked_environment_personal.jpg`: bereinigte alte Schatten plus in Blender berechnete differentielle Kontaktschatten der neuen Objekte. Computer, Tastatur, Diskettenbox, Monitor und Boot-Screen werden nicht umgebaut.

## Bearbeitung

Aktuell: `outputs/personal-desk/Robotron-Personal-Desk-v3.blend` im übergeordneten Workspace. Sammlung: `Personal desk · editable originals`. Einzelteile bleiben verborgen erhalten; sichtbare `PersonalDesk_*`-Objekte sind materialweise zusammengefasste Kopien. Das native Glasmaterial bleibt für Blender erhalten, `AmberGlassBaked` liegt zusätzlich in der Datei. Nach Geometrieänderungen: Kopien neu erstellen, `work/personal-desk/bake_glass.py` ausführen, dann `export_baked_glass.py`. Bei Positionsänderungen auch Kontaktschatten neu berechnen. Frühere Versionen bleiben erhalten.

Die Rauchbewegung existiert nur in der Website, nicht im statischen Blender-Render. Das bereitgestellte Cover bleibt als `babel-cover.png` zusätzlich zum eingebetteten GLB erhalten. Keine neuen Bibliotheken, Navigationselemente oder Inhaltsschnittstellen.
