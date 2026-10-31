import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { ProgressStrip } from './ProgressStrip';
import { PrecisionEraser } from './PrecisionEraser';
let root: Root, host: HTMLDivElement;
beforeEach(() => { const dom=new JSDOM('<!doctype html><body></body>',{url:'https://example.test'});for(const key of ['window','document','navigator','HTMLElement','Node','localStorage','CustomEvent','MouseEvent'])vi.stubGlobal(key,(dom.window as any)[key]);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); host=document.createElement('div');document.body.append(host);root=createRoot(host); });
afterEach(async () => { await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals(); });
it('keeps all markers available and does not recenter when only the timer rerenders', async()=>{
 const scrollTo=vi.fn();Object.defineProperty(HTMLElement.prototype,'scrollTo',{configurable:true,value:scrollTo});
 const render=(active:number)=>root.render(<ProgressStrip activeIndex={active} label="Question progress">{Array.from({length:10},(_,i)=><button key={i} data-progress-index={i}>{i+1}</button>)}</ProgressStrip>);
 await act(async()=>render(4));expect(host.querySelectorAll('button')).toHaveLength(10);expect(scrollTo).toHaveBeenCalledTimes(1);
 await act(async()=>render(4));expect(scrollTo).toHaveBeenCalledTimes(1);
 await act(async()=>render(5));expect(scrollTo).toHaveBeenCalledTimes(2);
});
it('erases at the visible arrow tip above the thumb and respects board boundaries', async()=>{
 let captured=false;
 Object.defineProperties(HTMLElement.prototype,{setPointerCapture:{configurable:true,value:()=>{captured=true;}},hasPointerCapture:{configurable:true,value:()=>captured}});
 const erase=vi.fn();await act(async()=>root.render(<PrecisionEraser bounds={()=>({left:0,top:0,right:400,bottom:700} as DOMRect)} onErase={erase}/>));
 const button=document.querySelector('button[aria-label^="Precision eraser"]')!;
 await act(async()=>button.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,clientX:120,clientY:300})));
 expect(erase).toHaveBeenLastCalledWith(120,232);
 await act(async()=>button.dispatchEvent(new MouseEvent('pointermove',{bubbles:true,clientX:160,clientY:350})));
 expect(erase).toHaveBeenLastCalledWith(160,282);
 const calls=erase.mock.calls.length;
 await act(async()=>button.dispatchEvent(new MouseEvent('pointermove',{bubbles:true,clientX:500,clientY:350})));
 expect(erase).toHaveBeenCalledTimes(calls);
});
