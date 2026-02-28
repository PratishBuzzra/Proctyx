import React from "react";
import { Link } from "react-router-dom";
import { GiBrassEye } from "react-icons/gi";
import { CiMail } from "react-icons/ci";
import { FaPhone } from "react-icons/fa6";
import { FaLocationDot } from "react-icons/fa6";

const Footer = () => {
  return (
    <footer className="bg-green-600 py-16 px-16">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-2 font-bold text-white">
            <h1 className="">Proctyx</h1>
            <GiBrassEye size={32} />
          </div>
          <p className="text-gray-200 leading-relaxed max-w-sm mb-3">
            A comprehensive online examination system designed for universities
            and colleges. Secure, reliable, and easy to use.
          </p>
          <div className="space-y-2 text-sm text-white">
              <div className="flex items-center gap-2">
                <CiMail />
                <p>support@Proctyx.edu</p>
              </div>
              <div className="flex items-center gap-2">
                <FaPhone/>
                <span>+977 9761628353</span>
              </div>
              <div className="flex items-center gap-2">
                <FaLocationDot />
                <span>Nayabazar, Kathmandu</span>
              </div>
            </div>
        </div>

        <div>
          <h4 className="text-xl font-bold mb-4 text-white">Quick links</h4>
          <ul className="space-y-2 text-gray-300 font-semibold">
            <li>
              <Link>Home</Link>
            </li>
            <li>
              <Link>about</Link>
            </li>
            <li>
              <Link>How It Works</Link>
            </li>
            <li>
              <Link>Exam Rules</Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-xl font-bold mb-4 text-white">Support</h4>
          <ul className="space-y-2 text-gray-300 font-semibold">
            <li>
              <Link>Help Center</Link>
            </li>
            <li>
              <Link>Contact Us</Link>
            </li>
            <li>
              <Link>FAQ</Link>
            </li>
            <li>
              <Link>Documentation</Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-xl font-bold mb-4 text-white">Legal</h4>
          <ul className="space-y-2 text-gray-300 font-semibold">
            <li>
              <Link>Privacy Policy</Link>
            </li>
            <li>
              <Link>Terms Of Service</Link>
            </li>
            <li>
              <Link>Academic Integrity</Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
