import Home from "@/components/Home";



export default async function HomePage() {
  await new Promise((r)=>{setTimeout(r, 5000);})
  return (
     <Home/>
  
  );
}
