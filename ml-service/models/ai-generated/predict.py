import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModelForSequenceClassification

MODEL_PATH = "./model"

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)

model.eval()

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)


def predict_text(text):
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
    probabilities = torch.nn.functional.softmax(logits, dim=1)

    predicted_class_id = torch.argmax(probabilities, dim=1).item()
    confidence = probabilities[0][predicted_class_id].item()

    label = model.config.id2label[predicted_class_id]

    if label == "Fake":
        final_prediction = "AI Generated"
    else:
        final_prediction = "Human Written"

    return final_prediction, confidence


if __name__ == "__main__":
    review_text = """
    I am thoroughly impressed by the overall performance and quality of this product. It delivers exactly what it promises and does so with outstanding consistency. The attention to detail is evident in every aspect, and the user experience is smooth and intuitive. Furthermore, its durability and efficiency make it a highly recommended choice for anyone seeking reliability and excellence."""

    prediction, confidence = predict_text(review_text)

    print("Text:\n", review_text)
    print("\nPrediction:", prediction)
    print("Confidence:", round(confidence * 100, 2), "%")
