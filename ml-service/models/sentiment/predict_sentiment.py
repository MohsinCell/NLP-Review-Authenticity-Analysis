import torch
import torch.nn as nn
from transformers import BertModel, BertTokenizer


class CustomBertForSentiment(nn.Module):
    def __init__(self):
        super(CustomBertForSentiment, self).__init__()
        self.bert = BertModel.from_pretrained("bert-base-uncased")

        self.classifier = nn.Sequential(
            nn.Linear(768, 512),
            nn.BatchNorm1d(512),
            nn.ReLU(),
            nn.Dropout(0.3),

            nn.Linear(512, 256),
            nn.BatchNorm1d(256),
            nn.ReLU(),
            nn.Dropout(0.3),

            nn.Linear(256, 2)
        )

    def forward(self, input_ids, attention_mask):
        outputs = self.bert(input_ids=input_ids, attention_mask=attention_mask)
        cls_output = outputs.pooler_output
        logits = self.classifier(cls_output)
        return logits


device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("Using device:", device)

tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")

model = CustomBertForSentiment()

state_dict = torch.load("Review_Sentiment.pt", map_location=device)

new_state_dict = {}
for k, v in state_dict.items():
    if k.startswith("module."):
        k = k[7:]
    new_state_dict[k] = v

model.load_state_dict(new_state_dict)
model.to(device)
model.eval()

print(" Model loaded successfully!\n")


def predict_sentiment(text):
    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=128
    )

    inputs = {k: v.to(device) for k, v in inputs.items()}

    with torch.no_grad():
        logits = model(inputs["input_ids"], inputs["attention_mask"])
        probs = torch.softmax(logits, dim=1)
        pred_index = torch.argmax(probs, dim=1).item()

    sentiment = "Negative" if pred_index == 0 else "Positive"
    confidence = probs[0][pred_index].item()

    return sentiment, confidence


if __name__ == "__main__":
    text = "Great! The book is very helpful for the beginner who really needs to become familar with the terminology.."
    sentiment, confidence = predict_sentiment(text)

    print("Review:", text)
    print("Prediction:", sentiment)
    print("Confidence:", round(confidence, 4))
