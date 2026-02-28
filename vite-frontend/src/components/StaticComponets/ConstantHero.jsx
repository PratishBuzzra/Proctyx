import React from 'react'
import {Link, NavLink} from "react-router-dom"

const ConstantHero = ({cName, heroTitle, heroText, heroDesc, heroIcon, iconclass }) => {
  return (
    <div className='bg-green-300'>
  <div className={cName}>
      <div className={heroDesc} >
        <div className={iconclass}>{heroIcon}</div>
        <h1 className='text-4xl md:text-5xl font-bold mb-6'>{heroTitle}</h1>
        <p className='text-lgd pb-4'>{heroText}</p>

      </div>
      
    </div>
    </div>
  )
}

export default ConstantHero
