import {useEffect,useRef} from "react";
import {Viewer} from "@photo-sphere-viewer/core";
import {GyroscopePlugin} from "@photo-sphere-viewer/gyroscope-plugin";
import "@photo-sphere-viewer/core/index.css";
import "./pano.css";

const DEMO_PANORAMA="https://photo-sphere-viewer-data.netlify.app/assets/sphere.jpg";

export default function Pano360(){
  const host=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!host.current)return;
    const viewer=new Viewer({
      container:host.current,
      panorama:DEMO_PANORAMA,
      plugins:[GyroscopePlugin],
      navbar:["zoom","move","gyroscope","fullscreen"],
      defaultZoomLvl:45,
      mousewheel:true,
      mousemove:true,
      touchmoveTwoFingers:false,
      caption:"360° Coworx-style workspace experience",
    });
    return()=>viewer.destroy();
  },[]);
  return <section className="panoSection"><div className="sectionHead panoHead"><div><span className="eyebrow">EXPERIENCE COWORX</span><h2>Step inside our space.</h2><p>Drag on desktop or swipe on your phone. Use the gyroscope button on supported phones to look around by moving your device.</p></div><span className="panoBadge">360° VIEW</span></div><div ref={host} className="panoViewer" aria-label="Interactive 360 degree panorama"/><p className="panoCredit">Demo panorama powered by Photo Sphere Viewer.</p></section>;
}
