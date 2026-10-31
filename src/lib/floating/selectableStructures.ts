// Selectable layouts: one empty shell plus independently selectable slot contents.
// This is editor parsing only. It never creates/persists Floating Numbers.
export interface SelectableStructure {
  end: number;
  template: string;
  slots: string[];
  roles: string[];
  layout: "matrix" | "bounds" | "accent" | "binomial" | "group";
  label: string;
  glyph?: string;
  rows?: number;
  cols?: number;
  left?: string;
  right?: string;
}
export const structureSlot = (index: number) => `\uE060${index}\uE061`;
export const fillStructure = (template: string, values: string[]): string =>
  template.replace(/\uE060(\d+)\uE061/g, (_, index) => values[Number(index)] || "\\square");

function group(source: string, at: number): { value: string; end: number } | null {
  if (source[at] !== "{") return null;
  let depth = 0;
  for (let i = at; i < source.length; i++) {
    if (source[i] === "\\") { i++; continue; }
    if (source[i] === "{") depth++;
    if (source[i] === "}" && --depth === 0) return { value: source.slice(at+1,i), end:i+1 };
  }
  return null;
}
function argument(source: string, at: number): { value: string; end: number } | null {
  while (/\s/.test(source[at] ?? "") && at < source.length) at++;
  if (source[at] === "{") return group(source,at);
  const command = /^\\[A-Za-z]+/.exec(source.slice(at));
  if (command) return {value:command[0],end:at+command[0].length};
  if (at >= source.length) return null;
  return {value:source[at],end:at+1};
}
/** Split only at the outer matrix depth. Nested fractions/matrices retain syntax. */
function splitCells(body: string): string[][] {
  const rows: string[][] = [[]];
  let cell="", braces=0, env=0;
  for (let i=0;i<body.length;i++) {
    const tag=/^\\(begin|end)\{[^}]+\}/.exec(body.slice(i));
    if (tag) { env+=tag[1]==="begin"?1:-1;cell+=tag[0];i+=tag[0].length-1;continue; }
    if (body[i]==="\\" && body[i+1]==="\\" && braces===0 && env===0) {
      rows[rows.length-1].push(cell.trim());cell="";rows.push([]);i++;continue;
    }
    if (body[i]==="&" && braces===0 && env===0) { rows[rows.length-1].push(cell.trim());cell="";continue; }
    if (body[i]==="\\" && /[{}&]/.test(body[i+1]??"")) {cell+=body[i]+body[++i];continue;}
    if(body[i]==="{")braces++;
    if(body[i]==="}")braces--;
    cell+=body[i];
  }
  rows[rows.length-1].push(cell.trim());
  return rows;
}
const MATRIX_DELIMITERS:Record<string,[string,string]>={
  matrix:["",""],smallmatrix:["",""],bmatrix:["[","]"],pmatrix:["(",")"],
  Bmatrix:["{","}"],vmatrix:["|","|"],Vmatrix:["‖","‖"],cases:["{",""],
};
const OPERATORS:Record<string,string>={sum:"∑",prod:"∏",coprod:"∐",int:"∫",iint:"∬",iiint:"∭",oint:"∮",lim:"lim",limsup:"lim sup",liminf:"lim inf"};
const ACCENTS:Record<string,string>={vec:"→",overrightarrow:"→",bar:"¯",overline:"¯",underline:"_",hat:"ˆ",tilde:"˜",dot:"˙",ddot:"¨"};

export function selectableStructureAt(source: string, at: number): SelectableStructure | null {
  const begin=/^\\begin\{([A-Za-z]+)\}/.exec(source.slice(at));
  if(begin && MATRIX_DELIMITERS[begin[1]]) {
    const env=begin[1],start=at+begin[0].length;
    const tags=/\\(begin|end)\{([A-Za-z]+)\}/g;tags.lastIndex=start;
    let depth=1,end=-1,bodyEnd=-1,tag:RegExpExecArray|null;
    while((tag=tags.exec(source))) {
      if(tag[2]!==env)continue;
      depth+=tag[1]==="begin"?1:-1;
      if(depth===0){bodyEnd=tag.index;end=tags.lastIndex;break;}
    }
    if(end<0)return null;
    const rows=splitCells(source.slice(start,bodyEnd));
    const cols=rows[0].length;
    if(!cols || rows.some(row=>row.length!==cols))return null; // never guess ragged shapes
    let index=0;
    const template=`\\begin{${env}}${rows.map(row=>row.map(()=>structureSlot(index++)).join(" & ")).join("\\\\")}\\end{${env}}`;
    const [left,right]=MATRIX_DELIMITERS[env];
    return {end,template,slots:rows.flat(),roles:rows.flatMap((row,r)=>row.map((_,c)=>`row ${r+1}, column ${c+1}`)),layout:"matrix",label:`${env==="cases"?"cases":"matrix"} structure ${rows.length} by ${cols}`,rows:rows.length,cols,left,right};
  }
  const command=/^\\([A-Za-z]+)/.exec(source.slice(at));
  if(!command)return null;
  const name=command[1];let cursor=at+command[0].length;
  if(OPERATORS[name]) {
    const slots:string[]=[],roles:string[]=[];
    let template=`\\${name}`;
    if(source.slice(cursor).startsWith("\\limits"))cursor+="\\limits".length;
    while(true){
      let next=cursor;while(next<source.length && /\s/.test(source[next]))next++;
      const script=source[next];if(script!=="_"&&script!=="^")break;
      const arg=argument(source,next+1);if(!arg)return null;
      const role=script==="_"?"lower":"upper";
      if(roles.includes(role))return null;
      template+=`${script}{${structureSlot(slots.length)}}`;slots.push(arg.value);roles.push(role);cursor=arg.end;
    }
    let bodyAt=cursor;while(bodyAt<source.length && /\s/.test(source[bodyAt]))bodyAt++;
    if(source[bodyAt]==="{") {
      const body=group(source,bodyAt);if(!body)return null;
      template+=`{${structureSlot(slots.length)}}`;slots.push(body.value);roles.push("body");cursor=body.end;
    }
    return {end:cursor,template,slots,roles,layout:"bounds",label:`${name} structure`,glyph:OPERATORS[name]};
  }
  if(name === "left") {
    const delimiter = (position:number) => {
      const match = /^(?:\\[A-Za-z]+|\\[{}|]|[^\s])/.exec(source.slice(position));
      return match ? {raw:match[0],end:position+match[0].length} : null;
    };
    const left=delimiter(cursor);if(!left)return null;
    const pairs=/\\(left|right)\b/g;pairs.lastIndex=left.end;
    let level=1,pair:RegExpExecArray|null;
    while((pair=pairs.exec(source))) {
      level+=pair[1]==="left"?1:-1;
      if(level!==0)continue;
      const right=delimiter(pairs.lastIndex);if(!right)return null;
      const visible=(raw:string)=>({"\\{":"{","\\}":"}","\\langle":"⟨","\\rangle":"⟩","\\lvert":"|","\\rvert":"|","\\lVert":"‖","\\rVert":"‖",".":""}[raw] ?? raw);
      return {end:right.end,template:`\\left${left.raw}${structureSlot(0)}\\right${right.raw}`,slots:[source.slice(left.end,pair.index)],roles:["body"],layout:"group",label:"bracket structure",left:visible(left.raw),right:visible(right.raw)};
    }
    return null;
  }
  const groups:Record<string,[string,string]>={abs:["|","|"],norm:["‖","‖"],floor:["⌊","⌋"],ceil:["⌈","⌉"]};
  if(groups[name]) {
    while(cursor<source.length && /\s/.test(source[cursor]))cursor++;
    const body=group(source,cursor);if(!body)return null;
    return {end:body.end,template:`\\${name}{${structureSlot(0)}}`,slots:[body.value],roles:["body"],layout:"group",label:`${name} structure`,left:groups[name][0],right:groups[name][1]};
  }
  if(ACCENTS[name] || name==="binom") {
    while(/\s/.test(source[cursor]??"")&&cursor<source.length)cursor++;
    const a=group(source,cursor);if(!a)return null;
    const slots=[a.value];cursor=a.end;
    if(name==="binom") {while(/\s/.test(source[cursor]??"")&&cursor<source.length)cursor++;const b=group(source,cursor);if(!b)return null;slots.push(b.value);cursor=b.end;}
    return {end:cursor,template:`\\${name}`+slots.map((_,i)=>`{${structureSlot(i)}}`).join(""),slots,roles:slots.map((_,i)=>name==="binom"?(i?"lower":"upper"):"body"),layout:name==="binom"?"binomial":"accent",label:`${name} structure`,glyph:ACCENTS[name]};
  }
  // Leave unknown and unsupported structures intact, never expose raw syntax.
  return null;
}
