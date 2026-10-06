import { prisma } from "@/lib/prisma";
import { appDate } from "@/lib/app-date";

/** Idempotent state-to-event sync. The unique (userId,eventKey) constraint is the final dedupe guard. */
export async function syncNotifications(userId: string) {
  const now=appDate();
  const [goals,wallets]=await Promise.all([
    prisma.savingGoal.findMany({where:{userId,status:"ACTIVE"},include:{contributions:{select:{amount:true}}}}),
    prisma.wallet.findMany({where:{userId, balance:{lt:0}},select:{id:true,name:true}}),
  ]);
  const events:{userId:string;eventKey:string;type:"GOAL_REACHED"|"GOAL_EXCEEDED"|"GOAL_DEADLINE"|"WALLET_NEGATIVE";title:string;message:string;referenceType:string;referenceId:string}[]=[];
  for(const goal of goals){const saved=goal.contributions.reduce((n,c)=>n+Number(c.amount),0),target=Number(goal.targetAmount);if(saved>=target){const exceeded=saved>target;events.push({userId,eventKey:`goal-${exceeded?"exceeded":"reached"}-${goal.id}`,type:exceeded?"GOAL_EXCEEDED":"GOAL_REACHED",title:exceeded?"Target terlampaui!":"Target tercapai!",message:`${goal.name} sudah terkumpul ${Math.round(saved/target*100)}% dari tujuan.`,referenceType:"goal",referenceId:goal.id});}if(goal.targetDate){const days=(goal.targetDate.getTime()-now.getTime())/86_400_000;if(days>=0&&days<=7)events.push({userId,eventKey:`goal-deadline-${goal.id}-${goal.targetDate.toISOString().slice(0,10)}`,type:"GOAL_DEADLINE",title:"Tenggat target mendekat",message:`${goal.name} memiliki tenggat dalam ${Math.ceil(days)} hari.`,referenceType:"goal",referenceId:goal.id});}}
  for(const wallet of wallets)events.push({userId,eventKey:`wallet-negative-${wallet.id}`,type:"WALLET_NEGATIVE",title:"Saldo dompet negatif",message:`${wallet.name} memiliki saldo di bawah nol.`,referenceType:"wallet",referenceId:wallet.id});
  if(events.length)await prisma.notification.createMany({data:events,skipDuplicates:true});
}
