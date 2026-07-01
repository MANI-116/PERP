"use client"
import Image from "next/image"
import React,{ useState, useContext} from "react"
import { UserContext } from "@/providers/userState";
import { useRouter } from "next/navigation";
export function Login(){
    const [email,setEmail] = useState<string>("");
    const [password,setPassword] = useState<string>("");

    const userContext = useContext(UserContext)

    const router = useRouter();

    async function handleSubmit(e:React.SubmitEvent<HTMLFormElement>){
        e.preventDefault();
        try {

            // const response = await fetch("http://localhost:3000/signup",{
            //     method:"POST",
            //     headers:{
            //         "Content-Type":"application/json",
            //         "Access-Control-Allow-Origin":"*",
            //     },
            //     body:JSON.stringify({
            //         email,
            //         password
            //     })
            // })
            // console.log(response)
            // const jsonData = await response.json()
            // console.log(jsonData);
            
            userContext.setUser({name:"mani",isLoggedIn:true})

            router.replace("/")
            
        } catch (error) {
            console.log("error on seding error");
            console.log(error);
        }
            
        

    }
    function handleEmailChange(e:React.ChangeEvent<HTMLInputElement>){
        setEmail(e.target.value);
        console.log(e.target.value);

    }

    function handlePasswordChange(e:React.ChangeEvent<HTMLInputElement>){
        setPassword(e.target.value);
        console.log(e.target.value);

    }

    return <div className="bg-zinc-800 rounded-md p-4  " >

        <div className="flex flex-col items-center mb-2">
            <Image src="/site-icon.png" width={60} height={60} alt="nothing brother"/> 
            <h1>Log in</h1>
        </div>

        <form onSubmit={(e)=>handleSubmit(e)} className="flex flex-col">

        <input type="text" placeholder="Email" onChange={(e)=>handleEmailChange(e)} className="bg-black/40  rounded-sm p-2 mb-2"/>

        <input type="password" placeholder="Password" onChange={(e)=>handlePasswordChange(e)} className="bg-black/40  rounded-sm p-2 mb-2"/>
        

        <button className="bg-blue-600 text-black p-1 rounded-sm mt-2 hover:bg-blue-800">
          SignUp
        </button>
        </form>  
       </div>     
      
}