import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export type HomeCard={id:string;title:string;description:string;body:string;photos:string[]};
export type HomeContent={eyebrow:string;title:string;description:string;cards:HomeCard[]};
export const DEFAULT_HOME_CONTENT:HomeContent={
  eyebrow:"SPACE TO DO YOUR THING",
  title:"One place. So many possibilities.",
  description:"From solo focus to team breakthroughs, choose the space that fits your day.",
  cards:[
    {id:"desk",title:"Your desk. Your focus.",description:"Regular & premium desks",body:"A focused full-day workspace with power, Wi-Fi and a comfortable workstation. Choose the exact available desk that suits your day.",photos:[]},
    {id:"meeting",title:"Bring the ideas.",description:"Meeting room · up to 8 people",body:"A private room for focused discussions, interviews and small team meetings with Wi-Fi, power and air conditioning.",photos:[]},
    {id:"conference",title:"Room for the whole team.",description:"Conference room · up to 18 people",body:"A larger professional room for presentations, team meetings, client sessions and collaborative work.",photos:[]},
    {id:"podcast",title:"Make something worth sharing.",description:"Creator studio · lights & microphones",body:"A creator-ready studio with the essential lighting, microphone and stand setup for podcasts and content sessions.",photos:[]},
  ]
};
export function watchHomeContent(cb:(content:HomeContent)=>void,onError?:(e:any)=>void){
  return onSnapshot(doc(db,"settings","homeContent"),s=>{const raw:any=s.exists()?s.data():{};const cards=DEFAULT_HOME_CONTENT.cards.map(base=>({...base,...(raw.cards||[]).find((x:any)=>x.id===base.id),photos:Array.isArray((raw.cards||[]).find((x:any)=>x.id===base.id)?.photos)?(raw.cards||[]).find((x:any)=>x.id===base.id).photos:[]}));cb({...DEFAULT_HOME_CONTENT,...raw,cards});},onError);
}
export async function saveHomeContent(content:HomeContent){
  await setDoc(doc(db,"settings","homeContent"),{...content,updatedAt:serverTimestamp()},{merge:true});
}
const read=(file:File)=>new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||""));r.onerror=()=>reject(Error("Could not read this photo."));r.readAsDataURL(file);});
export async function prepareContentImage(file:File){
  if(!file.type.startsWith("image/"))throw Error("Choose an image file.");
  if(file.size>10*1024*1024)throw Error("Choose a photo smaller than 10 MB.");
  const src=await read(file),img=await new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error("Could not open this photo."));i.src=src;});
  const scale=Math.min(1,960/img.naturalWidth,640/img.naturalHeight),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=canvas.getContext("2d");if(!ctx)throw Error("Photo processing is unavailable.");ctx.drawImage(img,0,0,canvas.width,canvas.height);let quality=.68,result=canvas.toDataURL("image/jpeg",quality);while(result.length>190000&&quality>.35){quality-=.08;result=canvas.toDataURL("image/jpeg",quality);}if(result.length>220000)throw Error("This image is still too large after compression.");return result;
}
