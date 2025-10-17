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
                Once the azimuth homing routine has sucessfully completed, prompt user to Map the Azimuth Range.
                If yes,
                  Assuming that the Homing Routine rotated in one direction until a limit switch was enegaged, backed off from the limit switch until disengaged, and stopped.
                    Read motor shaft angle value just off-set of limit switch #1.
                    Store value as a variable #1.
                    Rotate motor in opposite direction of homing routine at a moderate speed and consistant speed until limit switch #2 is engnaged.
                    Stop rotation.
                    Rotate opposite direction at minimal speed until limit switch #2 is disengaged.
                    Stop rotation.
                    Read motor shaft angle value just off-set of limit switch #2.
                    Store value as a variable #2.
              3) Independent option within a diagnostics, configuration, and/or calibration page either underneath the Antenna section or the Servo/Motor section.
                Potential process:
                  Run routine, specifing each step from begininng to end
                  Or, 
                  Run the homing routine - as phase I and add a phase II - as described above without the prompt. 
      Elevation:
        Elevation Ranging: Setting the upper and lower range values of the azimuth range of motion. 
          Scenario: 
            1) Possibly done only once during R&D. Recorded static/perminant values are stored and applied directly to other operations/functions.
            2) A pop-up option after standard power cycle, initial set-up, operation of the Elevation Homing routine has completed.
              Potential procress: 
                Once the azimuth homing routine has sucessfully completed, prompt user to Map the Azimuth Range.
                If yes,
                  Assuming that the Homing Routine rotated in one direction until a limit switch was enegaged, backed off from the limit switch until disengaged, and stopped.
                    Read motor shaft angle value just off-set of limit switch #1.
                    Store value as a variable #1.
                    Rotate motor in opposite direction of homing routine at a moderate speed and consistant speed until limit switch #2 is engnaged.
                    Stop rotation.
                    Rotate opposite direction at minimal speed until limit switch #2 is disengaged.
                    Stop rotation.
                    Read motor shaft angle value just off-set of limit switch #2.
                    Store value as a variable #2.
              3) Independent option within a diagnostics, configuration, and/or calibration page either underneath the Antenna section or the Servo/Motor section.
                Potential process:
                  Run routine, specifing each step from begininng to end
                  Or, 
                  Run the homing routine - as phase I and add a phase II - as described above without the prompt. 
        Geared Output Mapping: This describes mapping/converting the degree of motor input to a degree of antenna output.
          Application: Using Azimuth Range Mapping in terms of MKS servo57D (Fimware v1.0.6) motor shaft angles, from limit switch to limit switch, and mapping that range against the manufacturers stated Azimuth Range of -300° to +300° (600° total range).
