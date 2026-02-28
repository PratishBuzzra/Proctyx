import { useEffect } from "react";
import { useState } from "react";
import { createContext } from "react";

export const AuthContext = createContext()

export const AuthProvider = ({children}) => {
    const [isLoggedIn, setIsLoggedIn] = useState(false)
    const [teachername, setTeacherName] = useState(null)
    const [loading, setLoading] = useState(true)
    const [teacherId, setTeacherId] = useState(null)
    useEffect(()=>{
        const checkAuth = async ()=>{
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL}/teacher/teacherprotected`,{
                    method: 'GET',
                    credentials: "include"
                })
                if(res.ok){
                    const data = await res.json();
                    setIsLoggedIn(true)
                    setTeacherName(data.teacher.name)
                    setTeacherId(data.teacher.teacher_id)
                }
            } catch (error) {
                console.log("not logged in");
            }finally{
                setLoading(false)
            }
        };
        checkAuth()
    }, []);

    const login = async ()=>{
        setLoading(true)
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/teacher/teacherprotected`, {
                method: "GET",
                credentials: "include"
            });
            if(res.ok){
                const data = await res.json()
                setIsLoggedIn(true);
                setTeacherName(data.teacher.name)
                setTeacherId(data.teacher.teacher_id)
            }
        } catch (error) {
            console.error("auth failed");
        }finally{
            setLoading(false)
        }
    }

    const logout = async() => {
    await fetch(`${import.meta.env.VITE_API_URL}/teacher/logoutteacher`, {
            method: "POST",
            credentials: "include"
        })

    setIsLoggedIn(false);
    setTeacherName(null)
    setTeacherId(null)
     navigate("/")
     
    
  };
    return (
        <AuthContext.Provider value={{isLoggedIn, teacherId, teachername, loading, login, logout}}>
            {children}
        </AuthContext.Provider>
    )
}