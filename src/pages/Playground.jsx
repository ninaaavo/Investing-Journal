import { motion } from "framer-motion";

import { useState } from "react";
export default function Playground() {
    const [isHovering, setIsHovering] = useState(false);
  
  return (
<div
        onMouseEnter={() => {
          console.log("mouse enter");
          setIsHovering(true);
        }}
        onMouseLeave={() => {
          console.log("mouse leave");
          setIsHovering(false);
        }}
        
        className={`w-[400px] h-[400px] ${isHovering? "bg-white" : "bg-red-100"}`}
      >
        <div>NSJANAKJSNKJANJNAKJDNAKX</div>
                <div>NSJANAKJSNKJANJNAKJDNAKX</div>
        <div>NSJANAKJSNKJANJNAKJDNAKX</div>
        <div>NSJANAKJSNKJANJNAKJDNAKX</div>

        </div>  );
}
