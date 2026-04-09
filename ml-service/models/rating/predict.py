import os
import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModelForSequenceClassification

MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model_epoch_5_10")

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)

model.eval()

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)


def predict_review(text):
    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=512
    )

    inputs = {k: v.to(device) for k, v in inputs.items()}

    with torch.no_grad():
        outputs = model(**inputs)

    logits = outputs.logits
    probabilities = F.softmax(logits, dim=1)

    predicted_class_id = torch.argmax(probabilities, dim=1).item()
    confidence = probabilities[0][predicted_class_id].item()

    predicted_rating = predicted_class_id + 1

    return predicted_rating, confidence


if __name__ == "__main__":
    test_reviews = [
        "This product is absolutely amazing! Best purchase I've ever made.",
        "Terrible quality. Broke after one day. Complete waste of money.",
        "It's okay, nothing special. Does the job but could be better.",
        "Pretty good product overall. Minor issues but I'm satisfied.",
        "Worst experience ever. Do not buy this product.",
    ]

    for review in test_reviews:
        rating, conf = predict_review(review)
        print(f"Rating: {rating}/5 (Confidence: {conf:.2%})")
        print(f"  Review: {review[:80]}...")
        print()
