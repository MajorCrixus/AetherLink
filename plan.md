Options/Settings
Configuration: Refers to the settings and parameters that define how a system or software behaves. It is often used in the context of software development to describe how different configurations of software can affect system behavior.
Calibration: In the context of ADAS systems, calibration involves adjusting the performance of components like sensors or cameras to ensure they function correctly under various conditions. This process may include dynamic calibration, which uses multiple vehicle sensors, or static calibration, which relies on specific target placements. 
Diagnostics: This involves checking the operational status of a system, often using diagnostic tools to identify issues or errors. It is crucial for ensuring that systems, such as ADAS, are functioning as intended and can be repaired if necessary. 

  Calibration:
    Motors:
      Motor Calibration (Initial Setup): 
        Azimuth specific MKS sevo57D (Firmware v1.0.6) servo motor, address 0x01, calibration process performed by the motor firmware (command 0x80 or "CAL" menu option) without a load (Source: MKS SERVO42&57D_RS485 User Manual V1.0.6.pdf).
        Elevation specific MKS sevo57D (Firmware v1.0.6) servo motor, address 0x02, calibration process performed by the motor firmware (command 0x80 or "CAL" menu option) without a load (Source: MKS SERVO42&57D_RS485 User Manual V1.0.6.pdf).
        Cross-Level specific MKS sevo42D (Firmware v1.0.6) servo motor, address 0x03, calibration process performed by the motor firmware (command 0x80 or "CAL" menu option) without a load (Source: MKS SERVO42&57D_RS485 User Manual V1.0.6.pdf).
    GPS:
    IMU:
  Configuration:
    Antenna:
      Azimuth:
        Azimuth Ranging: Setting the upper and lower range values of the azimuth range of motion. 
          Scenario: 
            1) Possibly done only once during R&D. Recorded static/perminant values are stored and applied directly to other operations/functions.
            2) A pop-up option after standard power cycle, initial set-up, operation of the Azimuth Homing routine has completed.
              Potential procress: 
                Once the azimuth homing routine has sucessfully completed, prompt user to record the Azimuth range.
                If yes,
                  Assuming that the Homing Routine rotated in one direction until a limit switch was enegaged, backed off from the limit switch until disengaged, and stopped.
                    Read motor shaft angle value just off-set of limit switch #1.
                    Store value as azimuth limit variable #1.
                    Rotate motor in opposite direction of homing routine at a moderate speed and consistant speed until limit switch #2 is engnaged.
                    Stop rotation.
                    Rotate opposite direction at minimal speed until limit switch #2 is disengaged.
                    Stop rotation.
                    Read motor shaft angle value just off-set of limit switch #2.
                    Store value as azimuth limit variable #2.
            3) Independent option within a diagnostics, configuration, and/or calibration page either underneath the Antenna section or the Servo/Motor section.
                Potential process:
                  Run routine, specifing each step from begininng to end
                  Or, 
                  Run the azimuth homing routine - as phase I and add a phase II - as described above (minus the prompt). 
      Elevation:
        Elevation Ranging: Setting the upper and lower range values of the azimuth range of motion. 
          Scenario: 
            1) Possibly done only once during R&D. Recorded static/perminant values are stored and applied directly to other operations/functions.
            2) A pop-up option after standard power cycle, initial set-up, operation of the Elevation Homing routine has completed.
              Potential procress: 
                Once the elevation homing routine has sucessfully completed, prompt user to record the elevation range.
                If yes,
                  Assuming that the Homing Routine rotated in one direction until a stall was detected, backed off from the stalled point by a single micro-step, and stopped.
                    Read motor shaft angle value at location of home position #1.
                    Store value as elevation limit variable #1.
                    Rotate motor in opposite direction of homing routine at a slow to moderate speed consistantly until a second stall event is detected.
                    Stop rotation.
                    Rotate opposite direction a single micro-step.
                    Stop rotation.
                    Read motor shaft angle value at location of new stall event.
                    Store value as elevation limit variable #2.
            3) Independent option within a diagnostics, configuration, and/or calibration page either underneath the Antenna section or the Servo/Motor section.
                Potential process:
                  Run routine, specifing each step from begininng to end,
                  Or, 
                  Run the elevation homing routine - as phase I and add a phase II - as described above (minus the prompt). 
                  
        Geared Output Mapping: This describes mapping/converting the degree of motor input to a degree of antenna output.
          Application: Using Azimuth Range Mapping in terms of MKS servo57D (Fimware v1.0.6) motor shaft angles, from limit switch to limit switch, and mapping that range against the manufacturers stated Azimuth Range of -300° to +300° (600° total range).

Main Menu
├── Settings
│   ├── Configuration
│   |   ├── Servos
|   |   |   |  (Purpose: Allows users to set the static or semi-static parameters for each component (Source: MKS SERVO42&57D_RS485 User Manual V1.0.6.pdf). These are settings that are typically configured once and then rarely changed.)
|   |   |   |  (Examples: Servo: Work mode (SR_vFOC, SR_CLOSE), current limit, microstepping (Source: MKS SERVO42&57D_RS485 User Manual V1)
|   |   |   |
|   |   |   ├── Select 1 of 3 servo motors via dropdown menu ("Azimuth", "Elevation", "Cross-Level" = addresses 0x01, 0x02, 0x03) and only allow settings/parameters/conrols be interactable that are specific to the 42D or the 57D version motor.
|   |   │   │   ├── Set System Parameters (Mode, Current, Microstepping)
|   |   |   |   |   ├── Mode
|   |   |   |   |   |   ├── Open Pulse Interface ("CR_OPEN")
|   |   |   |   |   |   ├── Closed Pulse Interface ("CR_CLOSE")
|   |   |   |   |   |   ├── Field Oriented Control (FOC) Pulse Interface ("CR_vFOC")
|   |   |   |   |   |   ├── Open Serial Interface ("SR_OPEN")
|   |   |   |   |   |   ├── Closed Serial Interface ("SR_CLOSE")
|   |   |   |   |   |   └── Field Oriented Control (FOC) Serial Interface ("SR_vFOC") *Default for this project
|   |   |   |   |   ├── Working Current ("Ma")
|   |   |   |   |   |   ├── SERVO42D：0，200，400...，3000(mA) (default 1600 mA - Other Current such as 123mA need to be set by serial command)
|   |   |   |   |   |   └── SERVO57D：0，400，800...，5200(mA) (default 3200 mA - Other Current such as 123mA need to be set by serial command)
|   |   |   |   |   ├── Hold Current ("HoldMa") *Only editable if Open or Close mode is selected, vFOC mode has self-adapting current
|   |   |   |   |   |   └── 10%, 20%, 30%, 40%, 50%, 60%, 70%, 80%, 90% *Default: Holding Current is 50% of Working Current.
|   |   |   |   |   ├──  ("HoldMa") *Only editable if Open or Close mode is selected, vFOC mode has self-adapting current
|   |   |   |   |   |   └── 10%, 20%, 30%, 40%, 50%, 60%, 70%, 80%, 90% *Default: Holding Current is 50% of Working Current.

|   |   │   │   ├── Homing Parameters (HmTrig, HmDir, HmSpeed, EndLimit)
|   |   │   │   ├── Stall Protection (Enable/Disable)
|   |   │   │   ├── Limit Port Remap (Enable/Disable)
|   |   │   │   ├── 0_Mode (Enable/Disable, Speed, Direction)
|   |   │   │   └── [Advanced Settings]
|   │   ├── GPS
|   │   │   ├── Baud Rate
|   │   │   └── [Other GPS Configuration]
|   │   ├── IMU
|   │   │   ├── Baud Rate
|   │   │   └── [Other IMU Configuration]
|   │   └── SDR
|   │       ├── Frequency Range
|   │       ├── Gain Settings
|   │       └── [Other SDR Configuration]
|   ├── Calibration
|   │   ├── Servo
|   │   │   ├── Motor Calibration (Unloaded)
|   │   │   ├── Range Mapping (Degrees of Rotation)
|   │   │   └── [Advanced/Custom Calibration]
|   │   ├── GPS
|   │   │   ├── Compass Calibration
|   │   │   └── [Other GPS Calibration]
|   │   └── IMU
|   │       ├── Accelerometer Calibration
|   │       ├── Gyroscope Calibration
|   │       └── Magnetometer Calibration
|   ├── Diagnostics
|   │   ├── Servo
|   │   │   ├── Motor Status (RPM, Temperature, Errors)
|   │   │   ├── IO Port Status (Limit Switch, Enable)
|   │   │   ├── En Pins Status (Enabled/Disabled)
|   │   │   ├── Go Back to Zero Status
|   │   │   ├── Motor Shaft Protection Status
|   │   │   └── [Raw Encoder Values]
|   │   ├── GPS
|   │   │   ├── Signal Strength
|   │   │   ├── Number of Satellites
|   │   │   ├── Fix Quality
|   │   │   └── [Raw GPS Data]
|   │   ├── IMU
|   │   │   ├── Acceleration Values
|   │   │   ├── Angular Velocity Values
|   │   │   ├── Magnetic Field Values
|   │   │   └── [Raw IMU Data]
|   │   └── SDR
|   │       ├── Signal Strength
|   │       ├── Noise Floor
|   │       ├── Spectrum Analysis
|   │       └── [Raw SDR Data]
├── Operations
│   ├── Servo Control
│   │   ├── Manual Jogging
│   │   ├── Absolute Positioning
│   │   ├── Relative Positioning
│   │   └── Homing Routine
│   ├── Tracking
│   │   ├── Auto Track
│   │   ├── Manual Track
│   │   └── Pass Prediction
│   └── SDR Operations
│       ├── Calibrate
│       └── Tune to Frequency


II. Justification for Each Sub-Menu
Configuration:
Purpose: Allows users to set the static or semi-static parameters for each component (Source: MKS SERVO42&57D_RS485 User Manual V1.0.6.pdf). These are settings that are typically configured once and then rarely changed.
Examples:
Servo: Work mode (SR_vFOC, SR_CLOSE), current limit, microstepping (Source: MKS SERVO42&57D_RS485 User Manual V1.0.6.pdf).
GPS/IMU: Baud rate, data output format (Source: Engineered Context).
SDR: Frequency range, gain settings (Source: Engineered Context).
Calibration:
Purpose: Allows users to run routines that calibrate the sensors and actuators, ensuring their accuracy and reliability (Source: MKS SERVO42&57D_RS485 User Manual V1.0.6.pdf).
Examples:
Servo: Motor calibration (unloaded), range mapping (Source: MKS SERVO42&57D_RS485 User Manual V1.0.6.pdf).
GPS: Compass calibration (Source: Engineered Context).
IMU: Accelerometer, gyroscope, magnetometer calibration (Source: Engineered Context).
Diagnostics:
Purpose: Provides tools to monitor the real-time status and performance of each component, helping to identify issues and troubleshoot problems (Source: MKS SERVO42&57D_RS485 User Manual V1.0.6.pdf).
Examples:
Servo: Motor status (RPM, temperature, errors), IO port status (Source: MKS SERVO42&57D_RS485 User Manual V1.0.6.pdf).
GPS: Signal strength, number of satellites (Source: Engineered Context).
IMU: Acceleration, angular velocity, magnetic field values (Source: Engineered Context).
SDR: Signal strength, noise floor (Source: Engineered Context).
Operations:
Purpose: Provides controls and routines for the main functions of the system, such as servo control, tracking, and SDR operations (Source: Engineered Context).
Examples:
Servo Control: Manual jogging, absolute/relative positioning, homing routine (Source: Engineered Context).
Tracking: Auto track, manual track, pass prediction (Source: Engineered Context).
SDR Operations: Calibrate, tune to frequency (Source: Engineered Context).
III. MKS SERVO42D/57D Settings and Menu Mapping

Based on the provided "Menu description" from the MKS SERVO42D/57D documentation, here's a mapping of those settings to the proposed menu structure:

Configuration -> Servo -> Basic Settings:
Mode: Work mode selection (CR_OPEN, CR_CLOSE, CR_vFOC, SR_OPEN, SR_CLOSE, SR_vFOC) (Source: MKS SERVO42&57D_RS485 User Manual V1.0.6.pdf)
Ma: Working current (Source: MKS SERVO42&57D_RS485 User Manual V1.0.6.pdf)
HoldMa: Holding current percentage (Source: MKS SERVO42&57D_RS485 User Manual V1.0.6.pdf)
MStep: Subdivisions (microstepping) (Source: MKS SERVO42&57D_RS485 User Manual V1.0.6.pdf)
En: Effective level of EN pin (Source: MKS SERVO42&57D_RS485 User Manual V1.0.6.pdf)
Dir: Positive direction of motor rotation (Source: MKS SERVO42&57D_RS485 User Manual V1.0.6.pdf)
Configuration -> Servo -> Homing Parameters:
Hm_Trig: Effective level of the end stop (Source: MKS SERVO42&57D_RS485 User Manual V1.0.6.pdf)
Hm_Dir: Direction of go home (Source: MKS SERVO42&57D_RS485 User Manual V1.0.6.pdf)
Hm_Speed: Speed of go home (Source: MKS SERVO42&57D_RS485 User Manual V1.0.6.pdf)
Hm_Mode: Method of go home (Limited/noLimit) (Source: MKS SERVO42&57D_RS485 User Manual V1.0.6.pdf)
Hm_Ma: Current of “noLimit” go home (Source: MKS SERVO42&57D_RS485 User Manual V1.0.6.pdf)
`EndLimit`: Set the endstop-limit function
Configuration -> Servo -> Stall Protection:
Protect: Motor shaft locked-rotor protection function (Enable/Disable) (Source: MKS SERVO42&57D_RS485 User Manual V1.0.6.pdf)
Configuration -> System -> Limit Port Remap: This can be added
Configuration -> System -> 0_Mode:
0_Mode: Enable motor will go back to zero when power on with parameters
0_Speed: set speed of going back to zero
0_Dir : set direction of going back to zero
Operations -> Servo Control -> Homing Routine:
GoHome: Command to initiate the homing routine (Source: MKS SERVO42&57D_RS485 User Manual V1.0.6.pdf)
System -> AutoSDD :
Set auto turn off the OLED screen ( Enable or Disable).
System -> Others:
set the baud rate
set the the slave address
Choose whether the slave respond in speed/positon mode.
Choose whether to use MODBUS-RTU communication protocol.
IV. Considerations:

User Experience: Design the menu structure with the user in mind. Group related settings together and use clear and concise labels.
Flexibility: Allow for future expansion. Leave room in the menu structure for additional settings and features as the project evolves.
Accessibility: Ensure that all menu options are accessible and easy to use, even for users with limited technical expertise.
