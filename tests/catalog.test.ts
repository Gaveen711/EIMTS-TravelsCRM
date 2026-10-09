import { describe, expect, it } from "vitest";
import { parseMoney, moneyInput, serviceSchema, supplierSchema, servicePayload, supplierPayload } from "../src/lib/catalog/schema";
describe("catalog money",()=>{
 it("parses decimals exactly",()=>{expect(parseMoney("0.29","USD")).toBe(29);expect(parseMoney("123456.78","LKR")).toBe(12345678);expect(parseMoney("0001.2","USD")).toBe(120);});
 it("supports zero and three decimal currencies",()=>{expect(parseMoney("23","JPY")).toBe(23);expect(parseMoney("1.234","KWD")).toBe(1234);expect(moneyInput(1,"KWD")).toBe("0.001");});
 it.each(["-1","1e3","1.999","NaN","9007199254740992"])("rejects unsafe or invalid USD %s",value=>expect(()=>parseMoney(value,"USD")).toThrow());
 it("rejects unknown currencies and fractional yen",()=>{expect(()=>parseMoney("1","XYZ")).toThrow();expect(()=>parseMoney("1.2","JPY")).toThrow();});
});
describe("catalog validation",()=>{
 const input={name:"Airport transfer",description:"",category:"transport" as const,supplier_id:"",currency:"USD" as const,cost:"20.29",selling:"30.00",tax_rate:"12.5",is_active:true};
 it("maps amounts to integer storage",()=>expect(servicePayload(serviceSchema.parse(input))).toMatchObject({cost_minor:2029,selling_minor:3000,supplier_id:null,tax_rate:"12.5"}));
 it("rejects excessive tax and unsafe prices",()=>{expect(serviceSchema.safeParse({...input,tax_rate:"101"}).success).toBe(false);expect(serviceSchema.safeParse({...input,cost:"1.009"}).success).toBe(false);});
 it("validates suppliers",()=>{const supplier={name:"Hotel",kind:"hotel",email:"",phone:"",contact_name:"",address:"",payment_terms:"Net 30",notes:""};expect(supplierSchema.safeParse(supplier).success).toBe(true);expect(supplierSchema.safeParse({...supplier,email:"invalid"}).success).toBe(false);expect(supplierSchema.safeParse({...supplier,name:" "}).success).toBe(false);});
});

it("normalizes empty optional supplier fields for database email constraint",()=>{expect(supplierPayload(supplierSchema.parse({name:"Name only supplier",kind:"hotel",email:"",phone:"",contact_name:"",address:"",payment_terms:"",notes:""}))).toEqual({name:"Name only supplier",kind:"hotel",email:null,phone:null,contact_name:null,address:null,payment_terms:null,notes:null});});
