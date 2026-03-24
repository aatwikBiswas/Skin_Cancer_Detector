import os
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

import warnings
warnings.filterwarnings("ignore")

import tensorflow as tf
from tensorflow.keras.preprocessing import image
import numpy as np

IMG_SIZE = 224

# Load model
model = tf.keras.models.load_model("cnn_scratch_binary.keras")

def preprocess(img_path):
    img = image.load_img(img_path, target_size=(IMG_SIZE, IMG_SIZE))
    img_array = image.img_to_array(img) / 255.0
    img_array = np.expand_dims(img_array, axis=0)
    return img_array

def hybrid_predict(img_path, age, sex, history, symptoms):

    img_array = preprocess(img_path)

    pred = model.predict(img_array)[0][0]  # base model output

    # ---------------- RISK SCORING ----------------
    risk_score = pred

    # AGE FACTOR
    if age >= 40:
        risk_score += 0.025
    if age >= 65:
        risk_score += 0.05

    # SEX FACTOR (optional slight bias)
    if sex.lower() == "male":
        risk_score += 0.02

    # FAMILY HISTORY
    if history.lower() == "yes":
        risk_score += 0.1

    # SYMPTOMS CHECK
    symptoms = symptoms.lower()

    danger_keywords = [
        "bleeding",
        "itching",
        "growing",
        "pain",
        "change",
        "irregular",
        "darkening"
    ]

    for word in danger_keywords:
        if word in symptoms:
            risk_score += 0.05

    # Clamp between 0 and 1
    risk_score = max(0, min(1, risk_score))

    # ---------------- FINAL DECISION ----------------
    if risk_score > 0.7:
        label = "Cancer"
    elif risk_score < 0.3:
        label = "Not"
    else:
        label = "UNCERTAIN"

    # ---------------- OUTPUT ----------------
    print("\n==============================")
    print(f"🖼 Image: {img_path}")
    print(f"🧠 Model Output: {pred:.4f}")
    print(f"📊 Final Risk Score: {risk_score:.4f}")
    print(f"👤 Age: {age}, Sex: {sex}, History: {history}")
    print(f"⚠️ Symptoms: {symptoms}")
    print(f"\n🎯 FINAL PREDICTION: {label}")
    print("==============================")


# ---------------- TEST ----------------
hybrid_predict(
    img_path="test.jpg",
    age=60,
    sex="male",
    history="yes",
    symptoms="bleeding and growing"
)

hybrid_predict(
    img_path="test7.jpg",
    age=25,
    sex="female",
    history="no",
    symptoms="bleeding and pain"
)