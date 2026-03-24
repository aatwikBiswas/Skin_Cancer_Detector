from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import tensorflow as tf
from PIL import Image
import io

app = FastAPI()

# ✅ Enable CORS (frontend → backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Load trained model
model = tf.keras.models.load_model("cnn_scratch_binary.keras")

# ✅ Image preprocessing
def preprocess_image(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((224, 224))
    img = np.array(img) / 255.0
    img = np.expand_dims(img, axis=0)
    return img

# ✅ Home route
@app.get("/")
def home():
    return {"message": "DermAI Backend Running 🚀"}

# ✅ Prediction route
@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    age: int = Form(...),
    sex: str = Form(...),
    history: str = Form(...),
    symptoms: str = Form(...)
):
    try:
        # ── Read & preprocess image ──
        contents = await file.read()
        img = preprocess_image(contents)

        # ── Model prediction (0 → 1) ──
        pred = model.predict(img)[0][0]

        # ── Base risk score ──
        risk_score = float(pred)

        # ── Symptom-based scoring ──
        HIGH_RISK = ["bleeding", "growing", "darkening"]
        MED_RISK  = ["irregular border", "color change", "pain", "itching"]

        symptom_score = 0

        if symptoms != "none":
            symptom_list = [s.strip().lower() for s in symptoms.split(",")]

            for s in symptom_list:
                if s in HIGH_RISK:
                    symptom_score += 0.15
                elif s in MED_RISK:
                    symptom_score += 0.08

        risk_score += symptom_score

        # ── Other factors ──
        if history.lower() == "yes":
            risk_score += 0.1

        if age > 50:
            risk_score += 0.05

        # ── Clamp risk score ──
        risk_score = min(risk_score, 1.0)

        # ── Final label ──
        if pred > 0.5:
            label = "CANCEROUS"
        else:
            label = "NOT CANCEROUS"

        # 🔥 DEBUG LOGS (important)
        print("\n==============================")
        print(f"Raw Prediction: {pred}")
        print(f"Symptom Score Added: {symptom_score}")
        print(f"Final Risk Score: {risk_score}")
        print(f"Label: {label}")
        print("==============================\n")

        # ✅ Response
        return {
            "prediction": label,
            "risk_score": risk_score,
            "raw_prediction": float(pred)
        }

    except Exception as e:
        return {"error": str(e)}