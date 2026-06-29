import sys
from PIL import Image, ImageDraw, ImageFont

def draw_arrow(draw, start, end, color, width=6):
    # Draw line
    draw.line([start, end], fill=color, width=width)
    # Draw arrow head
    # simple triangle head pointing at end
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    length = (dx**2 + dy**2)**0.5
    if length == 0:
        return
    ux = dx / length
    uy = dy / length
    # scale of head
    head_len = 25
    head_width = 15
    
    p1 = (end[0] - head_len * ux + head_width * uy, end[1] - head_len * uy - head_width * ux)
    p2 = (end[0] - head_len * ux - head_width * uy, end[1] - head_len * uy + head_width * ux)
    
    draw.polygon([end, p1, p2], fill=color)

def annotate_dashboard():
    # Load dashboard1
    img = Image.open("screenshots/dashboard1.png").convert("RGBA")
    draw = ImageDraw.Draw(img)
    
    # 1. Highlight Top AI Banner
    # Top Banner is around X: 360 to 2450, Y: 10 to 100 (in a 2518 x 1282 image)
    draw.rectangle([360, 15, 2450, 95], outline=(99, 102, 241, 255), width=5)
    # Add label
    draw.rectangle([360, 95, 800, 140], fill=(99, 102, 241, 220))
    # Draw text (use default font since we may not have custom fonts locally in script)
    draw.text((380, 105), "Active Multi-Agent Orchestrator Banner", fill=(255, 255, 255, 255))
    
    # 2. Highlight IQ Coach trigger (floating action buttons bottom right)
    # X: 2360 to 2480, Y: 1140 to 1240
    draw.rectangle([2350, 1120, 2490, 1250], outline=(239, 68, 68, 255), width=5)
    # Arrow pointing to IQ Coach trigger
    draw_arrow(draw, (2150, 1180), (2330, 1180), (239, 68, 68, 255))
    # Label for IQ coach trigger
    draw.rectangle([1800, 1150, 2140, 1210], fill=(239, 68, 68, 220))
    draw.text((1820, 1170), "IQ Coach Assistant Trigger (Speech API)", fill=(255, 255, 255, 255))
    
    # Save image
    img.convert("RGB").save("screenshots/dashboard1_annotated.png")
    print("Saved screenshots/dashboard1_annotated.png")

def annotate_risk_model():
    # Load dashboard2
    img = Image.open("screenshots/dashboard2.png").convert("RGBA")
    draw = ImageDraw.Draw(img)
    
    # MLP neural network card on the dashboard (around X: 1980 to 2480, Y: 140 to 520)
    draw.rectangle([1970, 120, 2490, 500], outline=(16, 185, 129, 255), width=6)
    # Arrow pointing to Neural Net
    draw_arrow(draw, (1800, 310), (1950, 310), (16, 185, 129, 255))
    # Label
    draw.rectangle([1250, 280, 1780, 340], fill=(16, 185, 129, 220))
    draw.text((1270, 300), "Client-Side MLP Classifier (10-Epoch Online Learning)", fill=(255, 255, 255, 255))
    
    # Save image
    img.convert("RGB").save("screenshots/dashboard2_annotated.png")
    print("Saved screenshots/dashboard2_annotated.png")

def annotate_capacity():
    # Load dashboard3
    img = Image.open("screenshots/dashboard3.png").convert("RGBA")
    draw = ImageDraw.Draw(img)
    
    # Capacity dial widget (around X: 1970 to 2480, Y: 520 to 1100)
    draw.rectangle([1970, 520, 2490, 1100], outline=(245, 158, 11, 255), width=6)
    # Arrow pointing to dial
    draw_arrow(draw, (1800, 810), (1950, 810), (245, 158, 11, 255))
    # Label
    draw.rectangle([1300, 780, 1780, 840], fill=(245, 158, 11, 220))
    draw.text((1320, 800), "Cognitive Workload Capacity Dial & Audio HUD", fill=(255, 255, 255, 255))
    
    # Save image
    img.convert("RGB").save("screenshots/dashboard3_annotated.png")
    print("Saved screenshots/dashboard3_annotated.png")

if __name__ == "__main__":
    annotate_dashboard()
    annotate_risk_model()
    annotate_capacity()
