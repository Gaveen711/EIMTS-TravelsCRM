/* eslint-disable jsx-a11y/alt-text -- React PDF Image uses document text captions. */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import type { ItineraryInput } from "./schema";
import { moneyInput } from "@/lib/catalog/schema";
import { endDate, routeStops, pricingTotals } from "./schema";
const styles = StyleSheet.create({
  page: {
    padding: 38,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#253d34",
  },
  header: { padding: 22, marginBottom: 18, color: "#ffffff" },
  brand: { fontSize: 9, letterSpacing: 2 },
  title: {
    fontSize: 27,
    fontFamily: "Times-Roman",
    marginTop: 15,
    marginBottom: 12,
  },
  h2: { fontFamily: "Times-Roman", fontSize: 22, marginBottom: 12 },
  text: { lineHeight: 1.6, marginBottom: 12 },
  label: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  section: { marginTop: 15 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#dde4df",
    paddingVertical: 9,
  },
  image: { width: "100%", height: 190, objectFit: "cover", marginBottom: 5 },
  credit: { fontSize: 7, color: "#63746b", marginBottom: 12 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 38,
    right: 38,
    fontSize: 8,
    color: "#63746b",
  },
});
export function ItineraryPdf({
  input,
  photos = {},
  companyName = "Emerald Isle Travels",
  logo = null,
}: {
  input: ItineraryInput;
  photos?: Record<string, string>;
  companyName?: string;
  logo?: string | null;
}) {
  const totals = pricingTotals(input);
  return (
    <Document title={input.title} author={companyName}>
      <Page size="A4" style={styles.page}>
        <View style={[styles.header, { backgroundColor: input.primary_color }]}>
          {logo && (
            <View
              style={{
                backgroundColor: "#ffffff",
                padding: 5,
                width: 90,
                marginBottom: 10,
              }}
            >
              <Image
                src={logo}
                style={{ width: 80, height: 40, objectFit: "contain" }}
              />
            </View>
          )}
          <Text style={styles.brand}>{companyName}</Text>
          <Text style={styles.title}>{input.title}</Text>
          <Text>
            {input.destination} · {input.days.length} days ·{" "}
            {input.adults + input.children} travelers
          </Text>
          <Text>
            {input.start_date} — {endDate(input.start_date, input.days.length)}
          </Text>
          {input.reference && <Text>{input.reference}</Text>}
        </View>
        {photos[input.cover_image] && (
          <Image src={photos[input.cover_image]} style={styles.image} />
        )}
        <Text style={styles.credit}>{input.cover_credit}</Text>
        <Text style={styles.text}>{input.summary}</Text>
        <Text style={styles.text}>{input.arrangements}</Text>
        <View style={styles.section}>
          <Text style={styles.label}>YOUR ROUTE</Text>
          <Text style={styles.text}>{routeStops(input).join(" → ")}</Text>
          <Text style={styles.credit}>
            Illustrative sequence; transfer distances and driving times are
            confirmed separately.
          </Text>
        </View>
        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            companyName + " · " + pageNumber + " / " + totalPages
          }
        />
      </Page>
      {input.days.map((day, index) => (
        <Page key={index} size="A4" style={styles.page}>
          <Text style={[styles.label, { color: input.primary_color }]}>
            DAY {index + 1} · {day.destination} ·{" "}
            {endDate(input.start_date, index + 1)}
          </Text>
          <Text style={[styles.h2, { color: input.primary_color }]}>
            {day.title}
          </Text>
          {photos[day.image_url] && (
            <Image src={photos[day.image_url]} style={styles.image} />
          )}
          <Text style={styles.credit}>{day.photo_credit}</Text>
          <Text style={styles.text}>{day.description}</Text>
          {(["morning", "afternoon", "evening"] as const).map(
            (time) =>
              day[time] && (
                <View key={time} style={styles.section}>
                  <Text style={styles.label}>{time.toUpperCase()}</Text>
                  <Text style={styles.text}>{day[time]}</Text>
                </View>
              ),
          )}
          {day.accommodation && (
            <View style={styles.section}>
              <Text style={styles.label}>ACCOMMODATION</Text>
              <Text style={styles.text}>
                {day.accommodation} · {day.rooms} · {day.meals}
              </Text>
            </View>
          )}
          <Text
            style={styles.footer}
            fixed
            render={({ pageNumber, totalPages }) =>
              companyName + " · " + pageNumber + " / " + totalPages
            }
          />
        </Page>
      ))}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Travel details & pricing</Text>
        {input.pricing.map((item, index) => (
          <View key={index} style={styles.row} wrap={false}>
            <Text style={{ width: "65%" }}>
              {item.description} × {item.quantity}
            </Text>
            <Text>
              {input.currency}{" "}
              {moneyInput(totals.lines[index].total_minor, input.currency)}
            </Text>
          </View>
        ))}
        {input.pricing.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.text}>
              Subtotal: {input.currency}{" "}
              {moneyInput(totals.subtotal_minor, input.currency)} · Discount:{" "}
              {moneyInput(totals.discount_minor, input.currency)} · Tax:{" "}
              {moneyInput(totals.tax_minor, input.currency)}
            </Text>
            <Text style={styles.label}>
              TOTAL: {input.currency}{" "}
              {moneyInput(totals.total_minor, input.currency)}
            </Text>
          </View>
        )}
        {[
          ["INCLUSIONS", input.inclusions],
          ["EXCLUSIONS", input.exclusions],
          ["TERMS & CONDITIONS", input.terms],
        ].map(
          ([title, content]) =>
            content && (
              <View key={title} style={styles.section}>
                <Text style={styles.label}>{title}</Text>
                <Text style={styles.text}>{content}</Text>
              </View>
            ),
        )}
        <View style={styles.section}>
          <Text style={styles.label}>YOUR TRAVEL CONSULTANT</Text>
          <Text style={styles.text}>
            {input.consultant}\n{input.consultant_email} ·{" "}
            {input.consultant_phone}
          </Text>
        </View>
        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            companyName + " · " + pageNumber + " / " + totalPages
          }
        />
      </Page>
    </Document>
  );
}
