import os
import json
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

MODEL_PATH = "./model"


def print_separator(title):
    print("\n" + "=" * 60)
    print(f"{title}")
    print("=" * 60)


tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)


print_separator("MODEL ARCHITECTURE")

print(model)


print_separator("MODEL CONFIG")

config = model.config

for key, value in config.to_dict().items():
    print(f"{key}: {value}")


print_separator("PARAMETER STATISTICS")

total_params = sum(p.numel() for p in model.parameters())
trainable_params = sum(p.numel()
                       for p in model.parameters() if p.requires_grad)

print(f"Total Parameters: {total_params:,}")
print(f"Trainable Parameters: {trainable_params:,}")

print("\nLayer-wise Parameter Breakdown:")
for name, param in model.named_parameters():
    print(f"{name:60} {param.numel():>15,}")


print_separator("LABEL MAPPING")

print("id2label:", config.id2label)
print("label2id:", config.label2id)


print_separator("TOKENIZER INFO")

print("Tokenizer Class:", tokenizer.__class__.__name__)
print("Vocab Size:", tokenizer.vocab_size)
print("Model Max Length:", tokenizer.model_max_length)

print("\nSpecial Tokens:")
print("PAD:", tokenizer.pad_token)
print("CLS:", tokenizer.cls_token)
print("SEP:", tokenizer.sep_token)
print("BOS:", tokenizer.bos_token)
print("EOS:", tokenizer.eos_token)
print("UNK:", tokenizer.unk_token)


print_separator("RAW JSON FILE CONTENTS")

json_files = [
    "config.json",
    "tokenizer_config.json",
    "special_tokens_map.json"
]

for file in json_files:
    path = os.path.join(MODEL_PATH, file)
    if os.path.exists(path):
        print(f"\n--- {file} ---")
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            print(json.dumps(data, indent=4))
    else:
        print(f"{file} not found.")


print_separator("MODEL SUMMARY")

print(f"Model Type: {config.model_type}")
print(f"Hidden Size: {config.hidden_size}")
print(f"Number of Hidden Layers: {config.num_hidden_layers}")
print(f"Attention Heads: {config.num_attention_heads}")
print(f"Intermediate Size: {config.intermediate_size}")
print(f"Max Position Embeddings: {config.max_position_embeddings}")
print(f"Dropout: {config.hidden_dropout_prob}")
