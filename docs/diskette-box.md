# Interaktive Diskettenbox

Die rechte Tischseite enthält eine gebrauchte grau-beige 5¼-Zoll-Diskettenbox mit offenem Rauchglas-Kunststoffdeckel, kleinen Aufklebern, abgeriebenen Kanten und fünf handschriftlich beschrifteten Disketten. Die beiden bisherigen Ordner werden ausgeblendet; die Kaffeetasse bleibt erhalten.

## Bedienung

- Maus über die Box bewegen: eigene Kameraperspektive; die Disketten fächern sich auf. Es gibt kein sichtbares Disketten-Menü.
- Etikett überfahren: die entsprechende Diskette hebt sich an. Unsichtbare geschlossene Klickflächen verhindern das Durchklicken durch Naben- und Lesefenster.
- Diskette anklicken: anheben, drehen, ins linke Robotron-Laufwerk einschieben und Hebel schließen.
- Andere Diskette wählen: zuerst die alte Diskette ins ursprüngliche Fach zurücklegen, dann die neue einlegen.
- Belegtes Laufwerk anklicken: Diskette zurücklegen; das funktioniert auch aus der sitzenden Ansicht.
- Maus aus dem Diskettenbereich bewegen: zurück zur sitzenden Tischansicht, nicht zur Raum- oder Monitoransicht. Eine kleine Randtoleranz und 220 ms Austrittsverzögerung verhindern Flackern zwischen den Disketten. Während eines Wechsels wird der Rücksprung bis zum Abschluss der Bewegung zurückgestellt.
- Escape: Tischansicht. Im Diskettenfokus wählen die Tasten 1 bis 5 die Disketten, E wirft aus. Ein unsichtbarer Live-Status bleibt für Screenreader erhalten.
- Touch: Box antippen zum Fokussieren, anschließend Diskette antippen. Außerhalb antippen verlässt die Ansicht.
- Die Kritzelei auf der Halterung lautet **MARC**.
- Leise mechanische Geräusche und Laufwerks-LED begleiten die Bewegung. Der vorhandene Stummschalter gilt auch dafür. `prefers-reduced-motion` verkürzt die Bewegungen.

## Bewusst noch ohne Inhaltsumschaltung

Die Auswahl verändert keine Portfolio-Inhalte und kommuniziert nicht mit dem Monitor-Iframe. Die Reihenfolge ist: Über mich, Informatik, Jugendarbeit, Projekte, Kontakt. Der abgeschlossene Auswahlzustand steht in `DisketteBox.inserted` (Index oder `null`). Eine spätere Inhaltsanbindung gehört nach Abschluss der Einlegeanimation an diese Stelle.

## Dateien und Koordinaten

- `src/Application/World/DisketteBox.ts`: Labels, Interaktion, unabhängige Animationswarteschlange, Audio und Statusanzeige.
- `src/Application/World/diskettes.css`: Mauszeiger und nur für Screenreader sichtbare Statusmeldung; keine Menüoberfläche.
- `src/Application/Camera/CameraKeyframes.ts`: gemeinsame Perspektive auf Box und Laufwerk.
- `static/models/Diskettes/diskette_box.glb`: Draco-komprimiertes Modell mit eingebetteten Label-Texturen, ca. 744 KiB. Die fünf Wurzelobjekte heißen `Disk_0` bis `Disk_4`; `StorageBox` und `SmokeLid` bleiben eigenständig.
- `static/models/Diskettes/labels.jpg`: editierbarer Atlas mit fünf gleich hohen Zeilen. Das GLB enthält eine eingebettete Kopie; nach Änderung des Atlas ist ein erneuter Modell-Export erforderlich.
- `static/models/Computer/computer_setup_interactive.glb`: bisheriger Robotron, aufgeteilt in `RobotronBody` und `DriveLatch`, mit unveränderten beiden UV-Sätzen und bestehenden Farb-/Lichttexturen.
- `static/models/World/baked_environment_diskettes.jpg`: Raumtextur mit bereinigten Ordnerschatten und neu gebackenem Box-Kontaktschatten. Bewegliche Disketten werden nicht in den Tischschatten eingebrannt.
- `src/Application/World/MonitorScreen.ts`: unbeleuchtete schwarze CSS-Maske, damit die Beleuchtung der neuen Objekte das bestehende Monitorbild nicht überstrahlt.

Blender verwendet X rechts, Y hinten, Z oben. Der glTF-Export verwendet X rechts, Y oben, Z vorne. Die Website skaliert die Modelle einheitlich mit Faktor 900. Alle Animationspositionen sind lokal zur unverschobenen Modellwurzel; der Laufwerkshebel dreht um seine eigene Achse.

Beim Blender-Export **Selected Objects** und **Active Scene** aktivieren. Ohne Active Scene könnten ausgewählte Bake-Empfänger aus anderen Szenen mit exportiert werden. Kameras, Lichtquellen und Hilfsobjekte gehören nicht ins Web-GLB.

## Prüfung

`npm run test:diskettes` prüft alle fünf Auswahlen, automatischen Tausch, Auswerfen, schnelle Mehrfachklicks, die Kamerasperre, Rückkehr an Originalpositionen und reduzierte Bewegung bei drei simulierten Bildraten. Zusätzlich werden Hover ohne Klick, echte Raycasts durch das vordere Nabenloch, Randtoleranz, verzögerter Austritt, Rückkehr zur sitzenden Ansicht und Escape geprüft. Der Test verwendet echte Three.js-Transformationen und die exportierten GLB-Knoten; DOM/Audio werden isoliert ersetzt. Er ersetzt keine visuelle Browserprüfung.

`npm run build` erstellt den Produktionsbuild. Die bestehenden Asset-/Bundle-Größenwarnungen des Projekts bleiben möglich.

Die Boot-Screen-Datei ist von dieser Implementierung unabhängig und wird nicht mit den Disketten-Änderungen veröffentlicht.
