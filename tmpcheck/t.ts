import { joinChipsForMirror, mirrorLessonNoteRow } from "../src/lib/smartboard/mirrorFromLessonNote";
import { rowToAscii } from "../src/lib/smartboard/rowAscii";
for (const chips of [["2x²"],["2x²","+5x","=0"],["2x^{2}"],["√(9)"],["H₂O"],["2x²","2x²"]]) {
  const t = joinChipsForMirror(chips);
  const m = mirrorLessonNoteRow(t);
  console.log(JSON.stringify(chips), "->", JSON.stringify(t), "|", m.signature, "|ok", m.ok, "|", rowToAscii(m.row));
}
