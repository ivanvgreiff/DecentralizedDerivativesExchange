import numpy as np
import matplotlib.pyplot as plt

# Constants
e = np.e

# Define x-ranges
x1 = np.linspace(-20, 0, 400)                  # f(x) = 0 for x < 0
x2 = np.linspace(0, e, 200, endpoint=False)    # f(x) = (1/e)x for 0 ≤ x < e
x3 = np.linspace(e, 20, 300)                   # f(x) = ln(x) for x ≥ e

# Define y-values
y1 = np.zeros_like(x1)
y2 = (1/e) * x2
y3 = np.log(x3)

# Plot
plt.figure(figsize=(8, 6))
plt.plot(x1, y1, color='blue')
plt.plot(x2, y2, color='blue')
plt.plot(x3, y3, color='blue')

# Axis formatting
plt.title("Log-Option Contract", fontsize=14)
plt.xlabel("x", fontsize=12)
plt.ylabel("f(x)", fontsize=12)
plt.grid(True, which='both', linestyle='--', linewidth=0.5)

# Axis limits and ticks
plt.xlim(-20, 20)
plt.ylim(-5, 5)
plt.xticks(np.arange(-20, 21, 2))  # X-axis ticks every 2 units
plt.yticks(np.arange(-5, 5, 0.5))  # Y-axis ticks every 0.5 units

# Axes lines
plt.axhline(0, color='black', linewidth=0.8)
plt.axvline(0, color='black', linewidth=0.8)

# Show plot
plt.tight_layout()
plt.show()
