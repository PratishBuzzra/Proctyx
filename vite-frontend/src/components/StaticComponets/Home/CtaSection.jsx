import React from 'react'
import { Link } from 'react-router-dom'

const CtaSection = () => {
  return (
   <section className="py-24">

          <div className="container max-w-3xl mx-auto text-center px-4">
            <h2 className="text-3xl md:text-4xl  font-bold  mb-4">
              Ready to Transform Your Examination Process?
            </h2>
            <p className="text-lg mb-8">
              Join thousands of educational institutions that trust Proctyx 
              for secure and efficient online examinations.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/login">
                <button className='bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-500 transition'>
                  Start Free Trial

                </button>
              </Link>
              <Link to="/contact">
                <button className='bg-white shadow-xl px-6 py-3 rounded-lg font-medium'>
                  Contact Sales
                </button>
              </Link>
            </div>
          </div>
      </section>
  )
}

export default CtaSection
