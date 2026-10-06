type Point={label:string;income:number;expense:number};
export function CashFlowChart({data}:{data:Point[]}){
 const width=Math.max(520,data.length*34),height=210,pad=16,max=Math.max(1,...data.flatMap(x=>[x.income,x.expense]));
 const y=(v:number)=>height-pad-(v/max)*(height-pad*2),x=(i:number)=>pad+i*(width-pad*2)/Math.max(1,data.length-1);
 const path=(key:"income"|"expense")=>data.map((p,i)=>`${i?"L":"M"}${x(i)},${y(p[key])}`).join(" ");
 return <div style={{overflowX:data.length>14?"auto":"hidden"}} role="region" aria-label="Grafik pemasukan dan pengeluaran" tabIndex={0}><svg width={data.length>14?width:"100%"} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Grafik pemasukan dibanding pengeluaran"><line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad} stroke="#e6ecea"/><path d={path("income")} fill="none" stroke="#0f766e" strokeWidth="3" strokeLinejoin="round"/><path d={path("expense")} fill="none" stroke="#e28a68" strokeWidth="3" strokeLinejoin="round"/>{data.map((p,i)=><g key={`${p.label}-${i}`}><circle cx={x(i)} cy={y(p.income)} r="3" fill="#0f766e"/><circle cx={x(i)} cy={y(p.expense)} r="3" fill="#e28a68"/>{(i%Math.max(1,Math.ceil(data.length/8))===0||i===data.length-1)&&<text x={x(i)} y={height-1} textAnchor="middle" fontSize="9" fill="#71817f">{p.label}</text>}</g>)}</svg></div>
}
