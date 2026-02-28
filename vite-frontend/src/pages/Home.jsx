import React from 'react'
import Hero from '../components/StaticComponets/Home/Hero'
import About from '../components/StaticComponets/Home/About'
import Features from '../components/StaticComponets/Features'
import Footer from '../components/StaticComponets/Footer/Footer'
import StatsBar from '../components/StaticComponets/Home/StatsBar'
import HowWorks from '../components/StaticComponets/Home/HowWorks'
import CtaSection from '../components/StaticComponets/Home/CtaSection'
import MarqueeText from '../components/StaticComponets/Home/MarqueeText'
import BenefitsSection from '../components/StaticComponets/Home/Benefits'
import Benefits from '../components/StaticComponets/Home/Benefits'
import Navbar from '../components/StaticComponets/Navbar/Navbar'

const Home = () => {
  return (
    <div className='bg-green-100'>
      <Navbar/>
      <Hero />
      <MarqueeText />
      <StatsBar />
      <About />
      <HowWorks />
      <Benefits />
      <CtaSection />
      <Footer />
    </div>
  )
}

export default Home
