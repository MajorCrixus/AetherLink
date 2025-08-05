#!/usr/bin/env python3

import typer
import importlib.util
import sys
from time import sleep
from rich import print

app = typer.Typer(help="""
GPIO Diagnostic Script for Jetson AGX Orin

Examples:
  python gpio_test.py --pin 7 --direction in
  python gpio_test.py --pin 13 --direction out --set 1
""")

# Try to import Jetson.GPIO or gpiod dynamically
use_jetson_gpio = importlib.util.find_spec("Jetson.GPIO") is not None
use_gpiod = importlib.util.find_spec("gpiod") is not None

if not use_jetson_gpio and not use_gpiod:
    print("[bold red]❌ No GPIO library available. Please install Jetson.GPIO or gpiod.")
    sys.exit(1)

# GPIO Base for gpiod (adjust as needed for your chip)
GPIO_CHIP = "/dev/gpiochip4"
GPIO_MAP = {
    7: 6  # GPIO3_PQ.06 maps to line 6 on gpiochip4 for Jetson AGX Orin
}

@app.command()
def test(
    pin: int = typer.Option(..., "--pin", help="BCM pin number (e.g., 7)"),
    direction: str = typer.Option("in", "--direction", help="Direction: in or out"),
    set: int = typer.Option(None, "--set", help="Value to set if output (0 or 1)"),
):
    if use_jetson_gpio:
        import Jetson.GPIO as GPIO

        GPIO.setmode(GPIO.BOARD)
        mode = GPIO.IN if direction == "in" else GPIO.OUT
        GPIO.setup(pin, mode)

        if direction == "out" and set is not None:
            GPIO.output(pin, GPIO.HIGH if set else GPIO.LOW)
            print(f"⚙️ Set Pin {pin} to {'HIGH' if set else 'LOW'}")
        else:
            state = GPIO.input(pin)
            print(f"📍 Pin {pin} is {'HIGH' if state else 'LOW'}")

        GPIO.cleanup(pin)

    elif use_gpiod:
        import gpiod

        line_number = GPIO_MAP.get(pin)
        if line_number is None:
            print(f"[yellow]⚠️ Pin {pin} not mapped in GPIO_MAP. Add mapping to continue.")
            sys.exit(1)

        chip = gpiod.Chip(GPIO_CHIP)
        line = chip.get_line(line_number)

        config = gpiod.LineSettings()
        config.direction = (
            gpiod.LineDirection.INPUT
            if direction == "in"
            else gpiod.LineDirection.OUTPUT
        )

        request = gpiod.LineRequest()
        request.consumer = "gpio_test"
        request.request_type = (
            gpiod.LineRequest.DIRECTION_INPUT
            if direction == "in"
            else gpiod.LineRequest.DIRECTION_OUTPUT
        )

        line.request(request)

        if direction == "out" and set is not None:
            line.set_value(set)
            print(f"⚙️ Set Pin {pin} (Line {line_number}) to {'HIGH' if set else 'LOW'}")
        else:
            value = line.get_value()
            print(f"📍 Pin {pin} (Line {line_number}) is {'HIGH' if value else 'LOW'}")

        line.release()

if __name__ == "__main__":
    app()
