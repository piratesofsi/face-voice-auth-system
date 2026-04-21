import face_recognition
import numpy as np
import os
import pickle
from PIL import Image
import io

FACES_DIR = "embeddings/faces"
os.makedirs(FACES_DIR, exist_ok=True)

def bytes_to_rgb(image_bytes: bytes):
    img = Image.open(io.BytesIO(image_bytes))
    img = img.convert("RGB")
    arr = np.ascontiguousarray(np.array(img, dtype=np.uint8))
    return arr

def register_face(user_id: int, image_bytes: bytes) -> bool:
    try:
        rgb = bytes_to_rgb(image_bytes)
        face_locations = face_recognition.face_locations(rgb, model="hog")
        print(f"Face locations found: {face_locations}")

        if not face_locations:
            print("No face detected")
            return False

        encodings = face_recognition.face_encodings(rgb, known_face_locations=face_locations)

        if not encodings:
            print("Could not encode face")
            return False

        # Save all detected encodings so the user can be matched more reliably.
        with open(f"{FACES_DIR}/{user_id}.pkl", "wb") as f:
            pickle.dump(encodings, f)

        print(f"Face registered for user {user_id} with {len(encodings)} encoding(s)")
        return True

    except Exception as e:
        print(f"Error: {e}")
        return False


def verify_face(user_id: int, image_bytes: bytes, threshold=0.55) -> bool:
    path = f"{FACES_DIR}/{user_id}.pkl"

    if not os.path.exists(path):
        print(f"No face registered for user {user_id}")
        return False

    try:
        with open(path, "rb") as f:
            stored = pickle.load(f)

        rgb = bytes_to_rgb(image_bytes)
        face_locations = face_recognition.face_locations(rgb, model="hog")
        print(f"Face locations found: {face_locations}")

        if not face_locations:
            print("No face detected in login photo")
            return False

        encodings = face_recognition.face_encodings(rgb, known_face_locations=face_locations)

        if not encodings:
            print("Could not encode login face")
            return False

        stored_encodings = [stored] if isinstance(stored, np.ndarray) else list(stored)
        distances = face_recognition.face_distance(stored_encodings, encodings[0])
        best_distance = float(np.min(distances))
        print(f"Best face distance: {best_distance:.3f} (threshold: {threshold})")

        matched = best_distance < threshold
        if not matched:
            print(f"No match. Distances: {distances}")

        return matched

    except Exception as e:
        print(f"Error: {e}")
        return False