import { describe,expect,it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import sharp from "sharp";
import { ItineraryPdf } from "@/lib/itineraries/pdf";
import { blankItinerary } from "@/lib/itineraries/schema";
describe("Itinerary PDF branding",()=>{
 it("generates an A4 brochure with the configured company and a real logo",async()=>{
  const bytes=await sharp({create:{width:16,height:16,channels:4,background:{r:21,g:60,b:50,alpha:1}}}).png().toBuffer();
  const logo="data:image/png;base64,"+bytes.toString("base64");
  const document=ItineraryPdf({input:blankItinerary("10000000-0000-4000-8000-000000000001"),companyName:"Configured Travel Consultants",logo});
  const pdf=await renderToBuffer(document);
  expect(pdf.subarray(0,5).toString()).toBe("%PDF-");
  expect(pdf.toString("latin1")).toContain("Configured Travel Consultants");
  expect(pdf.length).toBeGreaterThan(1000);
 });
});
