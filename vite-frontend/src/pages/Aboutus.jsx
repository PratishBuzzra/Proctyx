import React from "react";
import ConstantHero from "../components/StaticComponets/ConstantHero";
import { GiBrassEye } from "react-icons/gi";
import OurMission from "../components/StaticComponets/Aboutus/OurMission";
import CoreValues from "../components/StaticComponets/Aboutus/CoreValues";
import Footer from "../components/StaticComponets/Footer/Footer";
import Team from "../components/StaticComponets/Aboutus/Team";
import Navbar from "../components/StaticComponets/Navbar/Navbar";
const Aboutus = () => {
  return (
    
    <div className="bg-green-100">
      <Navbar/>
      
      <ConstantHero
        cName="container max-w-3xl mx-auto py-32"
        heroDesc="mx-auto text-center px-4"
        iconclass="w-16 h-16 flex items-center justify-center mx-auto"
        heroIcon={<GiBrassEye size={32}/>}
        heroTitle="About Proctyx"
        heroText="Transforming educational assessment through innovative technology 
              and unwavering commitment to academic integrity."
      />
      <OurMission />
      <CoreValues />
      <Team />
      <Footer />
    </div>
  );
};

export default Aboutus;
