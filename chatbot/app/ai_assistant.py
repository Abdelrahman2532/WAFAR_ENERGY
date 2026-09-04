import sys
sys.stdout.reconfigure(encoding='utf-8')

from google import genai
from app.config import GEMINI_API_KEY
from app.analytics import fetch_household_data, average, get_day_value, percentage, detect_anomaly, weekly_summary
from app.predictor import predict_monthly_bill

client = genai.Client(api_key=GEMINI_API_KEY)


def test_connection():
    response = client.models.generate_content(
        model="gemini-3.6-flash",
        contents="Say hello in one short sentence."
    )
    return response.text


def build_context(consumption, avg, temperature, household_size, has_ac, peak_usage, saving_result, is_anomaly, predicted_monthly_kwh, estimated_bill):
    context = f"""
Today's data for this household:
- Consumption: {consumption} kWh
- Usual average: {avg} kWh
- Temperature: {temperature}°C
- Household size: {household_size}
- Has AC: {"Yes" if has_ac else "No"}
- Peak hours usage: {peak_usage} kWh
- Saving analysis: {saving_result}
- Is today's consumption unusual (anomaly)?: {"Yes" if is_anomaly else "No"}
- Predicted monthly consumption: {predicted_monthly_kwh} kWh
- Estimated monthly bill: {estimated_bill} EGP
"""
    return context


def ask_ai(context, question):
    prompt = f"""
{context}

User question: {question}

Answer the question based only on the data above.
Reply in Arabic (Egyptian dialect), in a clear and friendly way.
"""

    try:
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt
        )
        return response.text

    except Exception as e:
        print(f"AI connection error: {e}")
        return "عذرًا، حصلت مشكلة في الاتصال بالمساعد الذكي حاليًا. حاول تاني بعد شوية."


def get_ai_response(household_id, question):
    df = fetch_household_data(household_id)

    if df.empty:
        return "عذرًا، لا توجد بيانات لهذا المنزل. تأكد من رقم المنزل وحاول مرة أخرى."

    row = df.iloc[-1]

    avg = average(df)
    day_value = get_day_value(df, row['date'])

    saving_result = percentage(day_value, avg)

    anomalies = detect_anomaly(df)
    is_anomaly = row['date'] in anomalies['date'].values

    prediction = predict_monthly_bill(df)

    context = build_context(
        row['energy_consumption_kwh'],
        avg,
        row['avg_temperature_c'],
        row['household_size'],
        row['has_ac'],
        row['peak_hours_usage_kwh'],
        saving_result,
        is_anomaly,
        prediction['predicted_monthly_kwh'],
        prediction['estimated_bill_egp']
    )

    answer = ask_ai(context, question)
    return answer


def build_weekly_context(summary):

    

    anomaly_text = (
        f"Yes, on: {', '.join(summary['anomaly_days'])}"
        if summary["has_anomaly"]
        else "No"
    )

    context = f"""
Weekly data for this household (last 7 available days):
- Average daily consumption: {summary['average_daily_kwh']} kWh
- Highest consumption day: {summary['max_day']['date']} ({summary['max_day']['value']} kWh)
- Lowest consumption day: {summary['min_day']['date']} ({summary['min_day']['value']} kWh)
- Any unusual (anomalous) days this week?: {anomaly_text}
"""
    return context


def get_weekly_summary(household_id):

    df = fetch_household_data(household_id)

    if df.empty:
        return "عذرًا، لا توجد بيانات لهذا المنزل. تأكد من رقم المنزل وحاول مرة أخرى."

    summary = weekly_summary(df)
    context = build_weekly_context(summary)

    fixed_question = "لخصلي نمط استهلاك الكهرباء بتاعي الأسبوع ده بأسلوب ودود وبسيط."

    answer = ask_ai(context, fixed_question)
    return answer



if __name__ == "__main__":
    household_id = input("Enter household ID: ")

    while True:
        question = input("Ask about your consumption (or type 'exit' to quit): ")

        if question == "exit":
            break

        answer = get_ai_response(household_id, question)

        with open("D:/energy-ai-assistant/response.txt", "w", encoding="utf-8") as f:
            f.write(answer)

        print("Done, check response.txt")