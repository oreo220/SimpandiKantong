"use client";
export function ConfirmForm({action,question,children}:{action:(data:FormData)=>void|Promise<void>;question:string;children:React.ReactNode}){
 return <form action={action} onSubmit={event=>{if(!window.confirm(question))event.preventDefault()}}>{children}</form>;
}
