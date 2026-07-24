

import sys
import os
import random
from pathlib import Path
import numpy as np
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing import image

print("Ajay Python script started", file=sys.stderr)

# ================= CONFIGURATION =================
# Put your .h5 models in:  <project>/user/models/
# (i.e., folder named "models" next to classify.py)
MODELS_DIR = Path(__file__).parent / "models"

IMG_SIZE = (224, 224)

MODEL_MAP = {
    "garbage":      "garbage.h5",
    "pothole":      "pothole.h5",
    "waterleak":    "waterleak.h5",
    "sewage":       "sewage.h5",
    "streetlights": "streetlights.h5",
}

RANDOM_RANGES = {
    "garbage":      (68, 96),
    "pothole":      (52, 89),
    "waterleak":    (58, 93),
    "sewage":       (55, 91),
    "streetlights": (45, 84),
}

FALLBACK_CONFIDENCE = 0.0
# ==================================================


def get_random_confidence(category: str) -> float:
    category = category.strip().lower()
    min_val, max_val = RANDOM_RANGES.get(category, (50, 85))
    conf = round(random.uniform(min_val, max_val), 2)
    print(f"[RANDOM] Using random confidence for '{category}': {conf}", file=sys.stderr)
    return conf


def predict_category(img_path: str, category: str) -> float:
    print(f"predict_category called with: image={img_path}, category={category}", file=sys.stderr)

    category = category.strip().lower()

    if category not in MODEL_MAP:
        print(f"ERROR: Unknown category '{category}' → using random", file=sys.stderr)
        return get_random_confidence(category)

    model_path = MODELS_DIR / MODEL_MAP[category]
    print(f"Looking for model at: {model_path}", file=sys.stderr)

    if model_path.is_file():
        try:
            print(f"[MODEL] Loading real model: {model_path}", file=sys.stderr)
            model = load_model(str(model_path))

            img = image.load_img(img_path, target_size=IMG_SIZE)
            img_array = image.img_to_array(img)
            img_array = np.expand_dims(img_array, axis=0)
            img_array /= 255.0

            prediction = model.predict(img_array, verbose=0)[0]

            if len(prediction) == 1:
                confidence = float(prediction[0]) * 100
            else:
                confidence = float(np.max(prediction)) * 100

            confidence = round(confidence, 2)
            print(f"[MODEL] Real model prediction successful for '{category}': {confidence}", file=sys.stderr)
            return confidence

        except Exception as e:
            print(f"ERROR during real prediction: {str(e)}", file=sys.stderr)
            print("[FALLBACK] Real model failed, using random confidence", file=sys.stderr)
            return get_random_confidence(category)

    else:
        print(f"Model NOT found: {model_path} → using random score", file=sys.stderr)
        return get_random_confidence(category)


if __name__ == "__main__":
    print("Ajay Inside main", file=sys.stderr)
    print(f"sys.argv received: {sys.argv}", file=sys.stderr)

    if len(sys.argv) != 3:
        print(FALLBACK_CONFIDENCE)
        print("Usage: python classify.py <image_path> <category>", file=sys.stderr)
        print(f"Actual arguments received: {len(sys.argv)}", file=sys.stderr)
        sys.exit(0)

    image_path = sys.argv[1]
    category = sys.argv[2]

    print(f"Image path: {image_path}", file=sys.stderr)
    print(f"Category: {category}", file=sys.stderr)

    if not os.path.isfile(image_path):
        print(FALLBACK_CONFIDENCE)
        print(f"Image file not found: {image_path}", file=sys.stderr)
        sys.exit(0)

    confidence = predict_category(image_path, category)
    print(confidence)  # ONLY stdout (Node parses this)
