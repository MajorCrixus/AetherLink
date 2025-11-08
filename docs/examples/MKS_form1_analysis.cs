using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Windows.Forms;
using System.IO.Ports;
using System.Threading;
using System.Collections;

namespace MKS_ServoD_Control
{
    public partial class Form1 : Form
    {
        byte Addr;
        byte DataSended;
        string word16;
        int data16;
        string word32;
        long data32;
        string word64;
        long data64;
        string Text_BUF;

        int tCHK;
        int rCHK;
        byte[] Buffer;
        byte[] SerialBuffer_RX;
        int Data_Number;
        string str;
        string HV, FV;
        byte[] FV1 = new byte[] { 0, 0, 0 };
        uint Temp1 = 0, Temp2 = 0;
        byte txNotDisplay = 0, rxNotDisplay = 0;
        byte buttonEnable = 1;
        int buttonColdDownTime = 300, trackingModeTime = 100;
        byte serialSendState = 0, serialReceivedState = 0;
        byte trackingModeStep = 0, trackingModeEnable = 0, trackingModeState = 0;

        //指令
        int[] QueryCommand = new int[] { 0x30, 0x33, 0x39, 0x3A, 0x3B, 0x3E, //(0 进位制编码器值 1 输入累计脉冲数 2 位置角度误差 3 闭环驱动板的使能状态 4 单圈上电自动回零状态 5 堵转标志位)
                                        0xF3, 0xF3, //(6 使能驱动板 7 关闭驱动板)
                                        0xF6, //(8 电机速度控制模式-开始)
                                        0xF6, //(9 电机速度控制模式-停止)
                                        0xFF, //(10 开启上电自动运行)
                                        0xFF, //(11 关闭上电自动运行)
                                        0x84, //(12 细分设置-确认)
                                        0xFD, //(13 电机位置控制模式-开始)
                                        0x80, //(14 校准编码器)
                                        0x81, //(15 电机类型-确认)
                                        0x82, //(16 工作模式-确认)
                                        0x83, //(17 电流值(mA)-确认)
                                        0x85, //(18 使能设置-确认)
                                        0x86, //(19 电机方向-确认)
                                        0x87, //(20 自动熄屏-确认)
                                        0x88, //(21 堵转保护-确认)
                                        0x89, //(22 细分插补-确认)
                                        0x8A, //(23 串口波特率-确认)
                                        0x8B, //(24 电机通信地址-确认)
                                        0xA1, //(25 位置Kp-确认)
                                        0xA2, //(26 位置Ki-确认)
                                        0xA3, //(27 位置Kd-确认)
                                        0xA4, //(28 启动加速度-确认)
                                        0xA5, //(29 停止加速度-确认)
                                        0x90, //(30 回零模式-开启)
                                        0x90, //(31 限位参数)
                                        0x91, //(32 限位归零)
                                        0x92, //(33 直接归零)
                                        0x93, //(34 回零方向-确认)
                                        0x94, //(35 无限位开关回零-确认)
                                        0x3F, //(36 恢复出厂配置)
                                        0x3D, //(37 读取参数-解除堵转状态)
                                        0xFD, //(38 电机位置控制模式-停止)
                                        0x31, //(39 读取参数-累加制编码器值)
                                        0x32, //(40 读取参数-电机实时转速)
                                        0x8C, //(41 从机应答-确认)
                                        0x8D, //(42 从机分组-确认)
                                        0x40, //(43 版本信息)
                                        0xF4, //(44 电机位置控制模式-相对坐标-13控制)
                                        0xF5, //(45 电机位置控制模式-绝对坐标-13控制)
                                        0x34, //(46 读取IO端口状态)
                                        0x9B, //(47 保持电流-确认)
                                        0x8F, //(48 按键锁定-确认)
                                        0x9A, //(49 单圈回零)
                                        0xFE, //(50 电机位置控制模式-绝对脉冲-13控制)
                                        0x9E, //(51 限位重映射-确认)
                                        0xF7, //(52 紧急停止)
                                        0x41, //(53 复位重启电机)
                                        0x47, //(54 读取所有配置参数)
                                        0x48, //(55 读取所有状态参数)
                                        0x9D, //(56 EN回零与位置保护)
                                        0x36, //(57 写IO端口)
                                        0x35  //(58 读取参数-原始累加制编码器值)
                                        };

        //常用字节
        byte[] byte_data = new byte[] { 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10 };
        byte[] trackingModeDataSended = new byte[] { 54 };
        byte[] trackingModeCommand = new byte[] { 0x47 };

        //功能字节
        byte FWD = 0x80;
        byte RWD = 0x00;
        byte EN_ON = 0x01;
        byte EN_OFF = 0x00;
        byte Save_Speed = 0xC8;
        byte Clear_Speed = 0xCA;

        //数据
        ushort Subdivision;
        byte[] Pulse;
        byte[] RelAxis;
        byte[] AbsAxis;
        byte[] Start_ACC = { 0x10 }, Stop_ACC = { 0x10 };
        byte[] Speed_1, Speed_2;
        byte[] Current;
        ushort Max_Current;

        //状态接收
        byte EN_STATE_ON = 0x01;
        byte EN_STATE_OFF = 0x00;

        //状态字符串
        readonly string[] I_Ma = { "0", "400", "800", "1200", "1600", "2000", "2400", "2800", "3200", "3600", "4000", "4400", "4800", "5200" };
        readonly string EN_H = "H";
        readonly string EN_L = "L";
        readonly string EN_Hold = "Hold";
        readonly string Dir_CW = "CW";
        readonly string Dir_CCW = "CCW";
        readonly string Disable = "Disable";
        readonly string Enable = "Enable";
        readonly string[] UartBaud = { "9600", "19200", "25000", "38400", "57600", "115200", "256000" };
        readonly string[] UartAddr = { "0x01", "0x02", "0x03", "0x04", "0x05", "0x06", "0x07", "0x08", "0x09", "0x0a", "0x0b", "0x0c", "0x0d", "0x0e", "0x0f", "0x10" };
        readonly string[] HardVersion = { "Unknown Drive", "MKS SERVO42D_485", "MKS SERVO42D_CAN", "MKS SERVO57D_485", "MKS SERVO57D_CAN", "MKS SERVO28D_485", "MKS SERVO28D_CAN", "MKS SERVO35D_485", "MKS SERVO35D_CAN" };
        readonly string[] CurrentText_42D = { "100", "1000", "2000", "3000" };
        readonly string[] CurrentText_57D = { "100", "1000", "2000", "3000", "4000", "5000", "5200" };

        //语言转换

        string[] ConnectText1 = { "断开失败，请再次尝试。", "Disconnect failed, please try again." };
        string Text1_Connect;

        string[] WindowText1 = { "错误", "Error" };
        string Text1_window;

        string[] WindowText2 = { "警告", "Warning" };
        string Text2_window;

        string[] ConnectText2 = { "连接失败，请检查串口。", "Connection failed, please check the serial port." };
        string Text2_Connect;

        string[] SerialErrorText1 = { "串口数据发送出错，请检查。", "Serial data transmission error, please check." };
        string Text1_SerialError;

        string[] SerialErrorText2 = { "串口数据接收出错，请检查。", "Serial data reception error, please check." };
        string Text2_SerialError;

        string[] Speedgear_Text1 = { "错误：速度档位应为1-3000。", "Error: The speed gear should be 1-3000." };
        string Text1_Speedgear;

        string[] SubdivisionError_Text1 = { "错误：任意细分范围应在1-256。", "Error: Any subdivision range should be 1-256." };
        string Text1_SubdivisionError;

        string[] PulseError_Text1 = { "错误：脉冲数为32位，取值范围为1到4294967295。", "Error: number of pulses is 32 bits, range should be 1 to 4294967295." };
        string Text1_PulseError;

        string[] PulseError_Text2 = { "错误：脉冲数为32位，取值范围为-2147483647到2147483647。", "Error: number of pulses is 32 bits, range should be -2147483647 to 2147483647." };
        string Text2_PulseError;

        string[] AxisError_Text1 = { "错误：坐标值为32位，取值范围为 -2147483647到2147483647 或 0x00到0xFFFFFFFF。", "Error: number of axis is 32 bits, range should be -2147483647 to 2147483647 or 0x00 to 0xFFFFFFFF." };
        string Text1_AxisError;

        string[] UartAddrError_Text1 = { "错误：通信地址范围应在0x01-0xff。", "Error: UartAddr range should be 0x01-0xff." };
        string Text1_UartAddrError;

        string[] UartAddrError_Text2 = { "错误：连接设置中的通信地址范围应在0x00-0xff。", "Error: Connection Address range should be 0x00-0xff." };
        string Text2_UartAddrError;

        string[] CurrentError_Text = { "错误：电流档位应为0-5200。", "Error: The current gear should be 0-5200." };
        string Text_CurrentError;

        string[] CurrentError42D_Text = { "错误：电流档位应为0-3000。", "Error: The current gear should be 0-3000." };
        string Text_CurrentError42D;

        string[] CurrentError57D_Text = { "错误：电流档位应为0-5200。", "Error: The current gear should be 0-5200." };
        string Text_CurrentError57D;

        string[] DataError_Text1 = { "警告：请选择数据类型。", "Warning: Please select the data type." };
        string Text1_DataError;

        string[] EN_Text1 = { "使能", "Enable" };
        string Text1_EN;

        string[] EN_Text2 = { "没使能", "Disable" };
        string Text2_EN;

        string[] Zero_Text1 = { "回零中", "Returning" };
        string Text1_Zero;

        string[] Zero_Text2 = { "回零成功", "Return 0 success" };
        string Text2_Zero;

        string[] Zero_Text3 = { "回零失败", "Return 0 failed" };
        string Text3_Zero;

        string[] AutoZero_Text2 = { "上电回零成功", "Auto 0 success" };
        string Text2_AutoZero;

        string[] AutoZero_Text3 = { "上电回零失败", "Auto 0 failed" };
        string Text3_AutoZero;

        string[] Stall_Text1 = { "堵转", "Blocked" };
        string Text1_Stall;

        string[] Stall_Text2 = { "正常", "Unblocked" };
        string Text2_Stall;

        string[] General_Text1 = { "输入数据类型错误", "Wrong input data type" };
        string Text1_General;

        string[] General_Text2 = { "输入超出范围", "Input out of range" };
        string Text2_General;

        string[] Block_Text1 = { "解除成功", "Unblock success" };
        string Text1_Block;

        string[] Block_Text2 = { "解除失败", "Unblock failed" };
        string Text2_Block;

        string[] Dir_Text1 = { "正转", "Forward" };
        string Text1_Dir;

        string[] Dir_Text2 = { "反转", "Reverse" };
        string Text2_Dir;

        string[] Dir_Text3 = { "停止", "Stop" };
        string Text3_Dir;

        string[] Move_Text1 = { "电机移动成功", "Move complete" };
        string Text1_Move;

        string[] Move_Text2 = { "电机移动完成", "Move succeed" };
        string Text2_Move;

        string[] Move_Text3 = { "电机移动失败", "Move failed" };
        string Text3_Move;

        string[] Move_Text4 = { "电机移动中", "Moving" };
        string Text4_Move;

        string[] Move_Text5 = { "触碰限位停止", "Limit stop" };
        string Text5_Move;

        string[] Stop_Text1 = { "电机停止成功", "Stop complete" };
        string Text1_Stop;

        string[] Stop_Text2 = { "电机停止完成", "Stop succeed" };
        string Text2_Stop;

        string[] Stop_Text3 = { "电机停止失败", "Stop failed" };
        string Text3_Stop;

        string[] Stop_Text4 = { "电机停止中", "Stopping" };
        string Text4_Stop;

        string[] COM_Text1 = { "串口数据接收错误", "Data Error" };
        string Text1_COM;

        string[] Cal_Text1 = { "校准中", "Cal..." };
        string Text1_Cal;

        string[] Cal_Text2 = { "校准成功", "Cal done" };
        string Text2_Cal;

        string[] Cal_Text3 = { "校准失败", "Cal failed" };
        string Text3_Cal;

        string[] RX_Text1 = { "设置成功", "Setup succeed" };
        string Text1_RX;

        string[] RX_Text2 = { "设置失败", "Setup failed" };
        string Text2_RX;

        string[] Read_Text1 = { "读取成功", "Read succeed" };
        string Text1_Read;

        string[] Read_Text2 = { "读取失败", "Read failed" };
        string Text2_Read;

        string[] HardVer_Text = { "硬件版本", "Hardware Version" };
        string Text_HardVer;

        string[] FirmVer_Text = { "固件版本", "Firmware Version " };
        string Text_FirmVer;

        string[] Emergency_Stop1 = { "紧急停止成功", "Stop succeed" };
        string Stop1_Emergency;

        string[] Emergency_Stop2 = { "紧急停止失败", "Stop failed" };
        string Stop2_Emergency;

        string[] Motor_Restart1 = { "复位重启成功", "Restart succeed" };
        string Restart1_Motor;

        string[] Motor_Restart2 = { "复位重启失败", "Restart failed" };
        string Restart2_Motor;

        string[] Respond_CN = { "应答", "不应答", "不主动" };
        string[] Respond_EN = { "Respon", "notRespon", "notActive" };
        string[] Respond_Text;

        string[] WriteIO_CN = { "不写入", "写入0", "写入1", "保持不变" };
        string[] WriteIO_EN = { "notWrite", "Write0", "Write1", "Hold IO" };
        string[] WriteIO_Text;

        string[] Encoder_CN = { "进位值", "累加值", "原始累加值" };
        string[] Encoder_EN = { "Carry", "Addition", "Raw" };
        string[] Encoder_Text;

        public Form1()
        {
            InitializeComponent();
            System.Windows.Forms.Control.CheckForIllegalCrossThreadCalls = false;
            buttonColdDown.Interval = buttonColdDownTime;
            buttonColdDown.Tick += ButtonColdDown_Tick;
            trackingMode.Interval = trackingModeTime;
            trackingMode.Tick += trackingMode_Tick;
        }

        private void Get_Version()
        {
            //-------------------电机类型判断--------------------
            txNotDisplay = 1;
            rxNotDisplay = 1;
            tCHK = 0xFA + Addr + 0x40;
            Buffer = new byte[] { 0xFA, Addr, 0x40, (byte)tCHK };
            WriteByteToSerialPort(Buffer, 0, 4);
            Thread.Sleep(50);
            //---------------------------------------------------
        }

        private void Button1_Click(object sender, EventArgs e)
        {
            if (serialPort1.IsOpen)
            {
                try
                {
                    serialPort1.Close();
                    GB1_comboBox_串口.Enabled = true;
                    GB1_comboBox_波特率.Enabled = true;
                }
                catch
                {
                    MessageBox.Show(Text1_Connect, Text1_window);
                }
                GB1_button_连接主板.Enabled = true;
                GB1_button_断开连接.Enabled = false;
            }
            else
            {
                try
                {
                    serialPort1.PortName = GB1_comboBox_串口.Text;
                    serialPort1.BaudRate = Convert.ToInt32(GB1_comboBox_波特率.Text, 10);         
                    serialPort1.Open();
                    GB1_comboBox_串口.Enabled = false;
                    GB1_comboBox_波特率.Enabled = false;
                    GB1_button_连接主板.Enabled = false;
                    GB1_button_断开连接.Enabled = true;
                }
                catch
                {
                    MessageBox.Show(Text2_Connect, Text1_window);
                }
            }
        }
        private void button18_Click(object sender, EventArgs e)
        {
            try
            {
                serialPort1.Close();
                GB1_comboBox_串口.Enabled = true;
                GB1_comboBox_波特率.Enabled = true;
            }
            catch
            {
                MessageBox.Show(Text1_Connect, Text1_window);
            }

            GB1_button_连接主板.Enabled = true;
            GB1_button_断开连接.Enabled = false;
        }
        private void Button_Click(object sender, EventArgs e)             //按键共用一个处理函数
        {
            switch ( trackingModeEnable ) 
            {
                case 1:
                    if (buttonEnable == 1 && serialSendState == 0 && serialReceivedState == 0)
                    {
                        buttonEnable = 0;
                        trackingMode.Stop();
                        Button MyButton = (Button)sender;
                        DataSended = Convert.ToByte(MyButton.Tag);
                        SendRelevantData(QueryCommand[DataSended]);
                        buttonColdDown.Start();
                    }
                    break;
                case 0:
                    if (buttonEnable == 1 && serialSendState == 0 && serialReceivedState == 0)
                    {
                        buttonEnable = 0;
                        trackingMode.Stop();
                        Button MyButton = (Button)sender;
                        DataSended = Convert.ToByte(MyButton.Tag);
                        SendRelevantData(QueryCommand[DataSended]);
                        if (DataSended == 54 || DataSended == 55)
                            buttonColdDown.Interval = buttonColdDownTime;
                        else
                            buttonColdDown.Interval = buttonColdDownTime / 2;
                        buttonColdDown.Start();
                    }
                    break;
                default:
                    MessageBox.Show(Text1_window, Text2_window);
                    break;
            }
        }
        private void ButtonColdDown_Tick(object sender, EventArgs e)      //定时器按键CD事件
        {
            buttonEnable = 1;
            buttonColdDown.Stop();
        }
        private void trackingMode_Tick(object sender, EventArgs e)        //定时器跟踪模式事件
        {
            if (trackingModeEnable == 1 && serialSendState == 0 && serialReceivedState == 0)
            {
                trackingModeState = 1;
                txNotDisplay = 1;
                rxNotDisplay = 1;
                DataSended = trackingModeDataSended[trackingModeStep];
                SendRelevantData(trackingModeCommand[trackingModeStep]);
                trackingModeStep++;
                if (trackingModeStep >= 5)
                    trackingModeStep = 0;
                trackingModeState = 0;
            }
        }
        private void trackingMode_CheckedChanged(object sender, EventArgs e)        //跟踪模式勾选事件
        {
            if(GB2_checkbox_跟踪模式.Checked == true)
            {
                trackingModeEnable = 1;
            }
            else
            {
                trackingModeEnable = 0;
            }
        }
        private void ComboBox_DropDown(object sender, EventArgs e)
        {
            Addr = Convert.ToByte(GB1_comboBox_通讯地址.Text, 16);
            Get_Version();
        }
        private void WriteByteToSerialPort(byte[] data, byte start, byte length)
        {    //字节发送
            serialSendState = 1;
            if (serialPort1.IsOpen)                                     
            {
                try
                {
                    serialPort1.Write(data, start, length);
                    txDisplay();
                }
                catch
                {
                    MessageBox.Show(Text1_SerialError, Text1_window);//错误处理
                }
            }
            else
            {
                MessageBox.Show(Text1_SerialError, Text1_window);//错误处理
            }
            serialSendState = 0;
        }
        private void SendRelevantData(int data)                  //判断数据类并且发送
        {
            ushort SpeedText;
            ushort SpeedText2;
            ushort SubdivisionText;
            uint PulseText;
            int PulseText1;
            long RelAxisText;
            long AbsAxisText;
            byte UartAddrText;
            ushort Start_ACCText, Stop_ACCText;
            ushort CurrentText;
            byte HomeTrig = 0x00, HomeDir = 0x00, EndLimit = 0x00;
            byte Mode_0 = 0x00, Set_0 = 0x00, Speed_0 = 0x00, Dir_0 = 0x00;
            byte[] retValue;
            byte hm_mode = 0x00;
            ushort hm_ma = 0x00;
            byte g0Enable_and_Enble = 0x00;
            byte[] Tim, Errors;
            byte WriteIO = 0x00;


            try
            {
                Addr = Convert.ToByte(GB1_comboBox_通讯地址.Text, 16);
            }
            catch
            {
                MessageBox.Show(Text2_UartAddrError, Text1_window);
            }
            if (Addr <= 0xff && Addr >= 0x00)
            {
                if ((DataSended > 0 && DataSended < 6) || DataSended == 37 || DataSended == 40 || DataSended == 43 || DataSended == 46)
                //(1 输入累计脉冲数 2 位置角度误差 3 闭环驱动板的使能状态 4 单圈上电自动回零状态 5 堵转标志位 37 解除堵转状态 40 电机实时转速 43 版本信息 46 读取IO端口状态)
                {
                    if (DataSended == 2)
                    {
                        Get_Version();
                        if (trackingModeState == 1)
                        {
                            txNotDisplay = 1;
                            rxNotDisplay = 1;
                        }
                    }
                    if (DataSended == 46)
                    {
                        Get_Version();
                        GB5_textBox_IN1.Clear();
                        GB5_textBox_IN2.Clear();
                        GB5_textBox_OUT1.Clear();
                        GB5_textBox_OUT2.Clear();
                    }
                    tCHK = 0xFA + Addr + data;
                    Buffer = new byte[] { 0xFA, Addr, (byte)data, (byte)tCHK };
                    WriteByteToSerialPort(Buffer, 0, 4);
                }

                if (DataSended > 5 && DataSended < 8) //(6 使能驱动板 7 关闭驱动板)
                {
                    if (DataSended == 6)
                    {
                        tCHK = 0xFA + Addr + data + EN_ON;
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, EN_ON, (byte)tCHK };
                    }
                    else
                    {
                        tCHK = 0xFA + Addr + data + EN_OFF;
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, EN_OFF, (byte)tCHK };
                    }
                    WriteByteToSerialPort(Buffer, 0, 5);
                }

                if (DataSended == 8) //(8 电机速度控制模式-开始)
                {
                    try
                    {
                        SpeedText = Convert.ToUInt16(GB4_3_comboBox_速度档位.Text, 10);
                        Speed_1 = BitConverter.GetBytes(SpeedText);
                        if (SpeedText <= 3000 && SpeedText >= 1)
                        {
                            if (GB4_3_radioButton_反转.Checked)
                            {
                                Speed_1[1] |= RWD;
                            }
                            else if (GB4_3_radioButton_正转.Checked)
                            {
                                Speed_1[1] |= FWD;
                            }
                            tCHK = 0xFA + Addr + data + Speed_1[1] + Speed_1[0] + Start_ACC[0];
                            Buffer = new byte[] { 0xFA, Addr, (byte)data, Speed_1[1], Speed_1[0], Start_ACC[0], (byte)tCHK };
                            WriteByteToSerialPort(Buffer, 0, 7);
                            trackingMode.Start();
                        }
                        else
                            MessageBox.Show(Text1_Speedgear, Text1_window);
                    }
                    catch
                    {
                        MessageBox.Show(Text1_General, Text2_window);
                    }
                }

                if (DataSended == 9) //(9 电机速度控制模式-停止)
                {
                    tCHK = 0xFA + Addr + data + 0x00 + 0x00 + Stop_ACC[0];
                    Buffer = new byte[] { 0xFA, Addr, (byte)data, 0x00, 0x00, Stop_ACC[0], (byte)tCHK };
                    WriteByteToSerialPort(Buffer, 0, 7);
                    trackingMode.Start();
                }

                if (DataSended == 10) //(10 开启上电自动运行)
                {
                    tCHK = 0xFA + Addr + data + Save_Speed;
                    Buffer = new byte[] { 0xFA, Addr, (byte)data, Save_Speed, (byte)tCHK };
                    WriteByteToSerialPort(Buffer, 0, 5);
                }

                if (DataSended == 11) //(11 关闭上电自动运行)
                {
                    tCHK = 0xFA + Addr + data + Clear_Speed;
                    Buffer = new byte[] { 0xFA, Addr, (byte)data, Clear_Speed, (byte)tCHK };
                    WriteByteToSerialPort(Buffer, 0, 5);
                }

                if (DataSended == 12) //(12 细分设置-确认)
                {
                    try
                    {
                        SubdivisionText = Convert.ToUInt16(GB3_comboBox_细分设置.Text, 10);
                        if (SubdivisionText < 256 && SubdivisionText >= 1)
                        {
                            Subdivision = Convert.ToByte(SubdivisionText);
                            tCHK = 0xFA + Addr + data + Subdivision;
                            Buffer = new byte[] { 0xFA, Addr, (byte)data, (byte)Subdivision, (byte)tCHK };
                            WriteByteToSerialPort(Buffer, 0, 5);
                        }
                        else if (SubdivisionText == 256)
                        {
                            tCHK = 0xFA + Addr + data + 0x00;
                            Buffer = new byte[] { 0xFA, Addr, (byte)data, 0x00, (byte)tCHK };
                            WriteByteToSerialPort(Buffer, 0, 5);
                        }
                        else
                            MessageBox.Show(Text1_SubdivisionError, Text1_window);
                    }
                    catch
                    {
                        MessageBox.Show(Text1_General, Text2_window);
                    }
                }

                if (DataSended == 13) //(13 电机位置控制模式-开始)
                {
                    try
                    {
                        SpeedText2 = Convert.ToUInt16(GB4_4_comboBox_速度档位.Text, 10);
                        Speed_2 = BitConverter.GetBytes(SpeedText2);
                        switch (GB4_4_comboBox_模式切换.Text)
                        {
                            case "RelPulses":
                            case "相对脉冲数":
                                try
                                {
                                    PulseText = Convert.ToUInt32(GB4_4_textBox_脉冲数.Text, 10);
                                    Pulse = BitConverter.GetBytes(PulseText);
                                    if (SpeedText2 <= 3000 && SpeedText2 >= 1)
                                    {
                                        if (PulseText <= 4294967295 && PulseText >= 1)
                                        {
                                            if (GB4_4_radioButton_反转.Checked)
                                            {
                                                //Speed2 = Convert.ToByte(SpeedText2 | RWD);
                                                Speed_2[1] |= RWD;
                                                //Pulse = Convert.ToByte(PulseText);
                                            }
                                            else if (GB4_4_radioButton_正转.Checked)
                                            {
                                                //Speed2 = Convert.ToByte(SpeedText2 | FWD);
                                                Speed_2[1] |= FWD;
                                                //Pulse = Convert.ToByte(PulseText);
                                            }
                                            else
                                            {
                                                MessageBox.Show(Text1_window, Text2_window);
                                            }
                                            tCHK = 0xFA + Addr + data + Speed_2[1] + Speed_2[0] + Start_ACC[0] + Pulse[3] + Pulse[2] + Pulse[1] + Pulse[0];
                                            Buffer = new byte[] { 0xFA, Addr, (byte)data, Speed_2[1], Speed_2[0], Start_ACC[0], Pulse[3], Pulse[2], Pulse[1], Pulse[0], (byte)tCHK };
                                            WriteByteToSerialPort(Buffer, 0, 11);
                                            trackingMode.Start();
                                        }
                                        else
                                            MessageBox.Show(Text1_PulseError, Text1_window);
                                    }
                                    else
                                        MessageBox.Show(Text1_Speedgear, Text1_window);
                                }
                                catch
                                {
                                    MessageBox.Show(Text1_PulseError, Text1_window);
                                }
                                break;
                            case "AbsPulses":
                            case "绝对脉冲数":
                                DataSended = 50;
                                data = 0xFE;
                                try
                                {
                                    PulseText1 = Convert.ToInt32(GB4_4_textBox_脉冲数.Text, 10);
                                    Pulse = BitConverter.GetBytes(PulseText1);
                                    if (SpeedText2 <= 3000 && SpeedText2 >= 1)
                                    {
                                        if (PulseText1 <= 2147483647 && PulseText1 >= -2147483647)
                                        {
                                            tCHK = 0xFA + Addr + data + Speed_2[1] + Speed_2[0] + Start_ACC[0] + Pulse[3] + Pulse[2] + Pulse[1] + Pulse[0];
                                            Buffer = new byte[] { 0xFA, Addr, (byte)data, Speed_2[1], Speed_2[0], Start_ACC[0], Pulse[3], Pulse[2], Pulse[1], Pulse[0], (byte)tCHK };
                                            WriteByteToSerialPort(Buffer, 0, 11);
                                            trackingMode.Start();
                                        }
                                        else
                                            MessageBox.Show(Text2_PulseError, Text1_window);
                                    }
                                    else
                                        MessageBox.Show(Text1_Speedgear, Text1_window);
                                }
                                catch
                                {
                                    MessageBox.Show(Text2_PulseError, Text1_window);
                                }
                                break;
                            case "RelAxis":
                            case "相对坐标":
                                DataSended = 44;
                                data = 0xF4;
                                try
                                {
                                    Text_BUF = GB4_4_textBox_脉冲数.Text;
                                    if (Text_BUF.Length > 1)
                                    {
                                        if (Text_BUF[0] == '0' && (Text_BUF[1] == 'x' || Text_BUF[1] == 'X'))
                                        {
                                            RelAxisText = Convert.ToInt32(GB4_4_textBox_脉冲数.Text, 16);
                                            RelAxis = BitConverter.GetBytes(RelAxisText);
                                        }
                                        else
                                        {
                                            RelAxisText = Convert.ToInt32(GB4_4_textBox_脉冲数.Text, 10);
                                            RelAxis = BitConverter.GetBytes(RelAxisText * 16384 / 360);
                                        }
                                    }
                                    else
                                    {
                                        RelAxisText = Convert.ToInt32(GB4_4_textBox_脉冲数.Text, 10);
                                        RelAxis = BitConverter.GetBytes(RelAxisText * 16384 / 360);
                                    }
                                    if (SpeedText2 <= 3000 && SpeedText2 >= 1)
                                    {
                                        if (RelAxisText <= 2147483647 && RelAxisText >= -2147483647)
                                        {
                                            tCHK = 0xFA + Addr + data + Speed_2[1] + Speed_2[0] + Start_ACC[0] + RelAxis[3] + RelAxis[2] + RelAxis[1] + RelAxis[0];
                                            Buffer = new byte[] { 0xFA, Addr, (byte)data, Speed_2[1], Speed_2[0], Start_ACC[0], RelAxis[3], RelAxis[2], RelAxis[1], RelAxis[0], (byte)tCHK };
                                            WriteByteToSerialPort(Buffer, 0, 11);
                                            trackingMode.Start();
                                        }
                                    }
                                    else
                                        MessageBox.Show(Text1_Speedgear, Text1_window);
                                }
                                catch
                                {
                                    MessageBox.Show(Text1_AxisError, Text1_window);
                                }
                                break;
                            case "AbsAxis":
                            case "绝对坐标":
                                DataSended = 45;
                                data = 0xF5;
                                try
                                {
                                    Text_BUF = GB4_4_textBox_脉冲数.Text;
                                    if (Text_BUF.Length > 1)
                                    {
                                        if (Text_BUF[0] == '0' && (Text_BUF[1] == 'x' || Text_BUF[1] == 'X'))
                                        {
                                            AbsAxisText = Convert.ToInt32(GB4_4_textBox_脉冲数.Text, 16);
                                            AbsAxis = BitConverter.GetBytes(AbsAxisText);
                                        }
                                        else
                                        {
                                            AbsAxisText = Convert.ToInt32(GB4_4_textBox_脉冲数.Text, 10);
                                            AbsAxis = BitConverter.GetBytes(AbsAxisText * 16384 / 360);
                                        }
                                    }
                                    else
                                    {
                                        AbsAxisText = Convert.ToInt32(GB4_4_textBox_脉冲数.Text, 10);
                                        AbsAxis = BitConverter.GetBytes(AbsAxisText * 16384 / 360);
                                    }
                                    if (SpeedText2 <= 3000 && SpeedText2 >= 1)
                                    {
                                        if (AbsAxisText <= 2147483647 && AbsAxisText >= -2147483647)
                                        {
                                            tCHK = 0xFA + Addr + data + Speed_2[1] + Speed_2[0] + Start_ACC[0] + AbsAxis[3] + AbsAxis[2] + AbsAxis[1] + AbsAxis[0];
                                            Buffer = new byte[] { 0xFA, Addr, (byte)data, Speed_2[1], Speed_2[0], Start_ACC[0], AbsAxis[3], AbsAxis[2], AbsAxis[1], AbsAxis[0], (byte)tCHK };
                                            WriteByteToSerialPort(Buffer, 0, 11);
                                            trackingMode.Start();
                                        }
                                    }
                                    else
                                        MessageBox.Show(Text1_Speedgear, Text1_window);
                                }
                                catch
                                {
                                    MessageBox.Show(Text1_AxisError, Text1_window);
                                }
                                break;
                            default:
                                MessageBox.Show(Text1_General, Text2_window);
                                break;
                        }
                    }
                    catch
                    {
                        MessageBox.Show(Text1_General, Text2_window);
                    }
                }

                if (DataSended == 14) //(14 校准编码器)
                {
                    tCHK = 0xFA + Addr + data + byte_data[0];
                    Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[0], (byte)tCHK };
                    WriteByteToSerialPort(Buffer, 0, 5);
                }

                if (DataSended == 16) //(16 工作模式-确认)
                {
                    Text_BUF = GB3_comboBox_工作模式.Text;
                    if (Text_BUF == "CR_OPEN")
                    {
                        tCHK = 0xFA + Addr + data + byte_data[0];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[0], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }

                    else if (Text_BUF == "CR_CLOSE")
                    {
                        tCHK = 0xFA + Addr + data + byte_data[1];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[1], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }

                    else if (Text_BUF == "CR_vFOC")
                    {
                        tCHK = 0xFA + Addr + data + byte_data[2];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[2], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }

                    else if (Text_BUF == "SR_OPEN")
                    {
                        tCHK = 0xFA + Addr + data + byte_data[3];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[3], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }
                    else if (Text_BUF == "SR_CLOSE")
                    {
                        tCHK = 0xFA + Addr + data + byte_data[4];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[4], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }
                    else if (Text_BUF == "SR_vFOC")
                    {
                        tCHK = 0xFA + Addr + data + byte_data[5];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[5], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }
                }

                if (DataSended == 17) //(17 电流值(mA)-确认)
                {
                    Get_Version();
                    try
                    {
                        CurrentText = Convert.ToUInt16(GB3_comboBox_电流值.Text, 10);
                        Current = BitConverter.GetBytes(CurrentText);
                        if (CurrentText <= Max_Current && CurrentText >= 0)
                        {
                            tCHK = 0xFA + Addr + data + Current[1] + Current[0];
                            Buffer = new byte[] { 0xFA, Addr, (byte)data, Current[1], Current[0], (byte)tCHK };
                            WriteByteToSerialPort(Buffer, 0, 6);
                        }
                        else
                            MessageBox.Show(Text_CurrentError, Text1_window);
                    }
                    catch
                    {
                        MessageBox.Show(Text1_General, Text2_window);
                    }
                }

                if (DataSended == 18) //(18 使能设置-确认)
                {
                    Text_BUF = GB3_comboBox_使能设置.Text;
                    if (Text_BUF == EN_H)
                    {
                        tCHK = 0xFA + Addr + data + byte_data[1];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[1], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }

                    else if (Text_BUF == EN_L)
                    {
                        tCHK = 0xFA + Addr + data + byte_data[0];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[0], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }

                    else if (Text_BUF == EN_Hold)
                    {
                        tCHK = 0xFA + Addr + data + byte_data[2];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[2], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }
                }

                if (DataSended == 19) //(19 电机方向-确认)
                {
                    Text_BUF = GB3_comboBox_电机方向.Text;
                    if (Text_BUF == Dir_CW)
                    {
                        tCHK = 0xFA + Addr + data + byte_data[0];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[0], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }

                    else if (Text_BUF == Dir_CCW)
                    {
                        tCHK = 0xFA + Addr + data + byte_data[1];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[1], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }
                }

                if (DataSended == 20) //(20 自动熄屏-确认xx)
                {
                    Text_BUF = GB3_comboBox_自动熄屏.Text;
                    if (Text_BUF == Disable)
                    {
                        tCHK = 0xFA + Addr + data + byte_data[0];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[0], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }

                    else if (Text_BUF == Enable)
                    {
                        tCHK = 0xFA + Addr + data + byte_data[1];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[1], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }
                }

                if (DataSended == 21) //(21 堵转保护-确认)
                {
                    Text_BUF = GB3_comboBox_堵转保护.Text;
                    if (Text_BUF == Disable)
                    {
                        tCHK = 0xFA + Addr + data + byte_data[0];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[0], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }
                    else if (Text_BUF == Enable)
                    {
                        tCHK = 0xFA + Addr + data + byte_data[1];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[1], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }
                }

                if (DataSended == 22) //(22 细分插补-确认)
                {
                    Text_BUF = GB3_comboBox_细分插补.Text;
                    if (Text_BUF == Disable)
                    {
                        tCHK = 0xFA + Addr + data + byte_data[0];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[0], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }
                    else if (Text_BUF == Enable)
                    {
                        tCHK = 0xFA + Addr + data + byte_data[1];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[1], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }
                }

                if (DataSended == 23) //(23 串口波特率-确认)
                {
                    Text_BUF = GB3_comboBox_串口波特率.Text;
                    if (Text_BUF == UartBaud[0])            //9600
                    {
                        tCHK = 0xFA + Addr + data + byte_data[1];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[1], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }
                    else if (Text_BUF == UartBaud[1])      //19200
                    {
                        tCHK = 0xFA + Addr + data + byte_data[2];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[2], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }
                    else if (Text_BUF == UartBaud[2])      //25000
                    {
                        tCHK = 0xFA + Addr + data + byte_data[3];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[3], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }
                    else if (Text_BUF == UartBaud[3])      //38400
                    {
                        tCHK = 0xFA + Addr + data + byte_data[4];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[4], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }
                    else if (Text_BUF == UartBaud[4])      //57600
                    {
                        tCHK = 0xFA + Addr + data + byte_data[5];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[5], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }
                    else if (Text_BUF == UartBaud[5])      //115200
                    {
                        tCHK = 0xFA + Addr + data + byte_data[6];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[6], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }
                    else if (Text_BUF == UartBaud[6])      //256000
                    {
                        tCHK = 0xFA + Addr + data + byte_data[7];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[7], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }
                }

                if (DataSended == 24) //(24 电机通信地址-确认)
                {
                    try
                    {
                        UartAddrText = Convert.ToByte(GB3_comboBox_通讯地址.Text, 16);
                        if (UartAddrText <= 0xff && UartAddrText >= 0x01)
                        {
                            tCHK = 0xFA + Addr + data + UartAddrText;
                            Buffer = new byte[] { 0xFA, Addr, (byte)data, UartAddrText, (byte)tCHK };
                            WriteByteToSerialPort(Buffer, 0, 5);
                        }
                        else
                            MessageBox.Show(Text1_UartAddrError, Text1_window);
                    }
                    catch
                    {
                        MessageBox.Show(Text1_General, Text2_window);
                    }
                }

                if (DataSended == 28) //(28 启动加速度-确认)
                {
                    try
                    {
                        Start_ACCText = Convert.ToUInt16(GB4_1_comboBox_启动加速度.Text, 10);
                        if (Start_ACCText <= 255 && Start_ACCText >= 0)
                        {
                            Start_ACC = BitConverter.GetBytes(Start_ACCText);
                            try
                            {
                                Temp1++;
                                GB4_2_textBox_目标方向.Clear();
                                GB4_2_textBox_目标速度.Clear();
                                GB4_2_textBox_目标加速度.Clear();
                                GB4_2_textBox_电机状态.Clear();
                                GB4_2_textBox_电机状态.AppendText(Text1_RX + "(" + Temp1 + ")");
                            }
                            catch
                            {
                                Temp1 = 0;
                            }
                        }
                        else
                        {
                            MessageBox.Show(Text2_General, Text2_window);
                        }
                    }
                    catch
                    {
                        MessageBox.Show(Text1_General, Text2_window);
                    }
                }

                if (DataSended == 29) //(29 停止加速度-确认)
                {
                    try
                    {
                        Stop_ACCText = Convert.ToUInt16(GB4_1_comboBox_停止加速度.Text, 10);
                        if (Stop_ACCText <= 255 && Stop_ACCText >= 0)
                        {
                            Stop_ACC = BitConverter.GetBytes(Stop_ACCText);
                            try
                            {
                                Temp1++;
                                GB4_2_textBox_目标方向.Clear();
                                GB4_2_textBox_目标速度.Clear();
                                GB4_2_textBox_目标加速度.Clear();
                                GB4_2_textBox_电机状态.Clear();
                                GB4_2_textBox_电机状态.AppendText(Text1_RX + "(" + Temp1 + ")");
                            }
                            catch
                            {
                                Temp1 = 0;
                            }
                        }
                        else
                        {
                            MessageBox.Show(Text2_General, Text2_window);
                        }
                    }
                    catch
                    {
                        MessageBox.Show(Text1_General, Text2_window);
                    }
                }

                if (DataSended == 31) //(31 限位参数)
                {
                    Get_Version();
                    try
                    {
                        //触发电平
                        Text_BUF = GB5_comboBox_触发电平.Text;
                        if (Text_BUF == "Low")
                        {
                            HomeTrig = 0x00;
                        }
                        else if (Text_BUF == "High")
                        {
                            HomeTrig = 0x01;
                        }

                        //归零方向
                        Text_BUF = GB5_comboBox_归零方向.Text;
                        if (Text_BUF == "CW")
                        {
                            HomeDir = 0x00;
                        }
                        else if (Text_BUF == "CCW")
                        {
                            HomeDir = 0x01;
                        }

                        //归零使能
                        Text_BUF = GB5_comboBox_归零使能.Text;
                        if (Text_BUF == "Disable")
                        {
                            EndLimit = 0x00;
                        }
                        else if (Text_BUF == "Enable")
                        {
                            EndLimit = 0x01;
                        }

                        //归零速度
                        SpeedText = Convert.ToUInt16(GB5_comboBox_归零速度.Text, 10);
                        Speed_1 = BitConverter.GetBytes(SpeedText);

                        if(FV1[2] >= 0x03)
                        {
                            if (SpeedText <= 3000 && SpeedText >= 1)
                            {
                                tCHK = 0xFA + Addr + data + HomeTrig + HomeDir + Speed_1[1] + Speed_1[0] + EndLimit;
                                Buffer = new byte[] { 0xFA, Addr, (byte)data, HomeTrig, HomeDir, Speed_1[1], Speed_1[0], EndLimit, (byte)tCHK };
                                WriteByteToSerialPort(Buffer, 0, 9);
                            }
                            else
                                MessageBox.Show(Text1_Speedgear, Text1_window);
                        }
                        else
                        {
                            if (SpeedText <= 3000 && SpeedText >= 1)
                            {
                                tCHK = 0xFA + Addr + data + HomeTrig + HomeDir + Speed_1[1] + Speed_1[0];
                                Buffer = new byte[] { 0xFA, Addr, (byte)data, HomeTrig, HomeDir, Speed_1[1], Speed_1[0], (byte)tCHK };
                                WriteByteToSerialPort(Buffer, 0, 8);
                            }
                            else
                                MessageBox.Show(Text1_Speedgear, Text1_window);
                        }
                        //----
                    }
                    catch
                    {
                        MessageBox.Show(Text1_General, Text2_window);
                    }
                }

                if (DataSended == 32) //(32 限位归零)
                {
                    tCHK = 0xFA + Addr + data;
                    Buffer = new byte[] { 0xFA, Addr, (byte)data, (byte)tCHK };
                    WriteByteToSerialPort(Buffer, 0, 4);
                }

                if (DataSended == 33) //(33 直接归零)
                {
                    tCHK = 0xFA + Addr + data;
                    Buffer = new byte[] { 0xFA, Addr, (byte)data, (byte)tCHK };
                    WriteByteToSerialPort(Buffer, 0, 4);
                }

                if (DataSended == 35) //(35 无限位开关回零)
                {
                    Get_Version();
                    try
                    {
                        retValue = BitConverter.GetBytes(Convert.ToUInt32(GB5_comboBox_无限位返回距离.Text, 16));

                        Text_BUF = GB5_comboBox_无限位回零模式.Text;
                        if(Text_BUF == "Limit Home")
                        {
                            hm_mode = 0x00;
                        }
                        else if (Text_BUF == "noLimit Home")
                        {
                            hm_mode = 0x01;
                        }

                        hm_ma = Convert.ToUInt16(GB5_comboBox_无限位回零电流.Text, 10);
                        Current = BitConverter.GetBytes(hm_ma);
                        if (hm_ma <= Max_Current && hm_ma >= 0)
                        {
                            tCHK = 0xFA + Addr + data + retValue[3] + retValue[2] + retValue[1] + retValue[0] + hm_mode + Current[1] + Current[0];
                            Buffer = new byte[] { 0xFA, Addr, (byte)data, retValue[3], retValue[2], retValue[1], retValue[0], hm_mode, Current[1], Current[0], (byte)tCHK };
                            WriteByteToSerialPort(Buffer, 0, 11);
                        }
                        else
                            MessageBox.Show(Text_CurrentError, Text1_window);
                    }
                    catch
                    {
                        MessageBox.Show(Text1_General, Text2_window);
                    }
                }

                if (DataSended == 36) //(36 恢复出厂配置)
                {
                    tCHK = 0xFA + Addr + data;
                    Buffer = new byte[] { 0xFA, Addr, (byte)data, (byte)tCHK };
                    WriteByteToSerialPort(Buffer, 0, 4);
                }

                if (DataSended == 38) //(38 电机位置控制模式-停止)
                {
                    switch ( GB4_4_comboBox_模式切换.Text )
                    {
                        case "RelPulses":
                        case "相对脉冲数":
                            tCHK = 0xFA + Addr + QueryCommand[13] + 0x00 + 0x00 + Stop_ACC[0] + 0x00 + 0x00 + 0x00 + 0x00;
                            Buffer = new byte[] { 0xFA, Addr, (byte)QueryCommand[13], 0x00, 0x00, Stop_ACC[0], 0x00, 0x00, 0x00, 0x00, (byte)tCHK };
                            break;
                        case "AbsPulses":
                        case "绝对脉冲数":
                            tCHK = 0xFA + Addr + QueryCommand[50] + 0x00 + 0x00 + Stop_ACC[0] + 0x00 + 0x00 + 0x00 + 0x00;
                            Buffer = new byte[] { 0xFA, Addr, (byte)QueryCommand[50], 0x00, 0x00, Stop_ACC[0], 0x00, 0x00, 0x00, 0x00, (byte)tCHK };
                            break;
                        case "RelAxis":
                        case "相对坐标":
                            tCHK = 0xFA + Addr + QueryCommand[44] + 0x00 + 0x00 + Stop_ACC[0] + 0x00 + 0x00 + 0x00 + 0x00;
                            Buffer = new byte[] { 0xFA, Addr, (byte)QueryCommand[44], 0x00, 0x00, Stop_ACC[0], 0x00, 0x00, 0x00, 0x00, (byte)tCHK };
                            break;
                        case "AbsAxis":
                        case "绝对坐标":
                            tCHK = 0xFA + Addr + QueryCommand[45] + 0x00 + 0x00 + Stop_ACC[0] + 0x00 + 0x00 + 0x00 + 0x00;
                            Buffer = new byte[] { 0xFA, Addr, (byte)QueryCommand[45], 0x00, 0x00, Stop_ACC[0], 0x00, 0x00, 0x00, 0x00, (byte)tCHK };
                            break;
                        default:
                            MessageBox.Show(Text1_General, Text2_window);
                            break;
                    }
                    WriteByteToSerialPort(Buffer, 0, 11);
                    trackingMode.Start();
                }

                if (DataSended == 39) //(39 读取参数-累加制编码器值)
                {
                    switch (GB2_comboBox_读编码值.Text)
                    {
                        case "进位值":
                        case "Carry":
                            DataSended = 0;
                            data = 0x30;
                            tCHK = 0xFA + Addr + data;
                            Buffer = new byte[] { 0xFA, Addr, (byte)data, (byte)tCHK };
                            WriteByteToSerialPort(Buffer, 0, 4);
                            break;
                        case "累加值":
                        case "Addition":
                            DataSended = 39;
                            data = 0x31;
                            tCHK = 0xFA + Addr + data;
                            Buffer = new byte[] { 0xFA, Addr, (byte)data, (byte)tCHK };
                            WriteByteToSerialPort(Buffer, 0, 4);
                            break;
                        case "原始累加值":
                        case "Raw":
                            DataSended = 58;
                            data = 0x35;
                            tCHK = 0xFA + Addr + data;
                            Buffer = new byte[] { 0xFA, Addr, (byte)data, (byte)tCHK };
                            WriteByteToSerialPort(Buffer, 0, 4);
                            break;
                    }
                }

                if (DataSended == 41) //(41 从机应答-确认)
                {
                    switch (GB3_comboBox_从机应答.Text)
                    {
                        case "Respon":
                        case "应答":
                            tCHK = 0xFA + Addr + data + byte_data[1] + byte_data[1];
                            Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[1], byte_data[1], (byte)tCHK };
                            WriteByteToSerialPort(Buffer, 0, 6);
                            break;
                        case "notRespon":
                        case "不应答":
                            tCHK = 0xFA + Addr + data + byte_data[0] + byte_data[0];
                            Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[0], byte_data[0], (byte)tCHK };
                            WriteByteToSerialPort(Buffer, 0, 6);
                            break;
                        case "notActive":
                        case "不主动":
                            tCHK = 0xFA + Addr + data + byte_data[1] + byte_data[0];
                            Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[1], byte_data[0], (byte)tCHK };
                            WriteByteToSerialPort(Buffer, 0, 6);
                            break;
                    }
                }

                if (DataSended == 42) //(42 从机分组-确认)
                {
                    try
                    {
                        UartAddrText = Convert.ToByte(GB3_comboBox_从机分组.Text, 16);
                        if (UartAddrText <= 0xff && UartAddrText >= 0x01)
                        {
                            tCHK = 0xFA + Addr + data + UartAddrText;
                            Buffer = new byte[] { 0xFA, Addr, (byte)data, UartAddrText, (byte)tCHK };
                            WriteByteToSerialPort(Buffer, 0, 5);
                        }
                        else
                            MessageBox.Show(Text1_UartAddrError, Text1_window);
                    }
                    catch
                    {
                        MessageBox.Show(Text1_General, Text2_window);
                    }
                }

                if (DataSended == 47) //(47 保持电流-确认)
                {
                    byte holdMaType;
                    switch ( GB3_comboBox_保持电流.Text )
                    {
                        case "10%":
                            holdMaType = 0x00;
                            break;
                        case "20%":
                            holdMaType = 0x01;
                            break;
                        case "30%":
                            holdMaType = 0x02;
                            break;
                        case "40%":
                            holdMaType = 0x03;
                            break;
                        case "50%":
                            holdMaType = 0x04;
                            break;
                        case "60%":
                            holdMaType = 0x05;
                            break;
                        case "70%":
                            holdMaType = 0x06;
                            break;
                        case "80%":
                            holdMaType = 0x07;
                            break;
                        case "90%":
                            holdMaType = 0x08;
                            break;
                        default:
                            GB3_comboBox_保持电流.Text = "50%";
                            holdMaType = 0x04;
                            MessageBox.Show(Text1_General, Text2_window);
                            break;
                    }
                    tCHK = 0xFA + Addr + data + holdMaType;
                    Buffer = new byte[] { 0xFA, Addr, (byte)data, holdMaType, (byte)tCHK };
                    WriteByteToSerialPort(Buffer, 0, 5);
                }

                if (DataSended == 48) //(48 按键锁定-确认)
                {
                    Text_BUF = GB3_comboBox_按键锁定.Text;
                    if (Text_BUF == "UnLock")
                    {
                        tCHK = 0xFA + Addr + data + byte_data[0];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[0], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }
                    else if (Text_BUF == "Lock")
                    {
                        tCHK = 0xFA + Addr + data + byte_data[1];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[1], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }
                }

                if (DataSended == 49) //(49 单圈回零)
                {
                    try
                    {
                        //回零模式
                        Text_BUF = GB5_comboBox_回零模式.Text;
                        if (Text_BUF == "Disable")
                        {
                            Mode_0 = 0x00;
                        }
                        else if (Text_BUF == "DirMode")
                        {
                            Mode_0 = 0x01;
                        }
                        else if (Text_BUF == "NearMode")
                        {
                            Mode_0 = 0x02;
                        }

                        //设置零点
                        switch (GB5_comboBox_设置零点.Text)
                        {
                            case "Clear 0":
                                Set_0 = 0x00;
                                break;
                            case "Set 0":
                                Set_0 = 0x01;
                                break;
                            case "Hold 0":
                                Set_0 = 0x02;
                                break;
                        }

                        //回零方向
                        Text_BUF = GB5_comboBox_回零方向.Text;
                        if (Text_BUF == "CW")
                        {
                            Dir_0 = 0x00;
                        }
                        else if (Text_BUF == "CCW")
                        {
                            Dir_0 = 0x01;
                        }

                        //回零速度
                        Speed_0 = Convert.ToByte(GB5_comboBox_回零速度.Text, 10);

                        tCHK = 0xFA + Addr + data + Mode_0 + Set_0 + Speed_0 + Dir_0;
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, Mode_0, Set_0, Speed_0, Dir_0, (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 8);
                        //----
                    }
                    catch
                    {
                        MessageBox.Show(Text1_General, Text2_window);
                    }
                }

                if (DataSended == 51) //(51 限位重映射)
                {
                    Text_BUF = GB5_comboBox_限位重映射.Text;
                    if (Text_BUF == "Disable")
                    {
                        tCHK = 0xFA + Addr + data + byte_data[0];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[0], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }
                    else if (Text_BUF == "Enable")
                    {
                        tCHK = 0xFA + Addr + data + byte_data[1];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, byte_data[1], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }
                }

                if (DataSended == 52) //(52 紧急停止)
                {
                    tCHK = 0xFA + Addr + data;
                    Buffer = new byte[] { 0xFA, Addr, (byte)data, (byte)tCHK };
                    WriteByteToSerialPort(Buffer, 0, 4);
                }

                if (DataSended == 53) //(53 复位重启电机)
                {
                    tCHK = 0xFA + Addr + data;
                    Buffer = new byte[] { 0xFA, Addr, (byte)data, (byte)tCHK };
                    WriteByteToSerialPort(Buffer, 0, 4);
                }

                if (DataSended == 54 || DataSended == 55) //(54 读取所有配置参数 & 55 读取所有状态参数)
                {
                    tCHK = 0xFA + Addr + data;
                    Buffer = new byte[] { 0xFA, Addr, (byte)data, (byte)tCHK };
                    WriteByteToSerialPort(Buffer, 0, 4);
                }

                if (DataSended == 56) //(56 EN回零与位置保护)
                {
                    try
                    {
                        g0Enable_and_Enble = 0x00;
                        switch (GB5_comboBox_EN回零.Text)
                        {
                            case "Disable":
                                g0Enable_and_Enble = 0x00;
                                break;
                            case "Enable":
                                g0Enable_and_Enble = 0x02;
                                break;
                        }

                        switch (GB5_comboBox_位置保护.Text)
                        {
                            case "Disable":
                                g0Enable_and_Enble |= 0x00;
                                break;
                            case "Enable":
                                g0Enable_and_Enble |= 0x01;
                                break;
                        }

                        Tim = BitConverter.GetBytes(Convert.ToUInt16(GB5_comboBox_触发时间.Text, 10));

                        Errors = BitConverter.GetBytes(Convert.ToUInt16(GB5_comboBox_触发距离.Text, 10));

                        tCHK = 0xFA + Addr + data + g0Enable_and_Enble + Tim[1] + Tim[0] + Errors[1] + Errors[0];
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, g0Enable_and_Enble, Tim[1], Tim[0], Errors[1], Errors[0], (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 9);
                    }
                    catch
                    {
                        MessageBox.Show(Text1_General, Text2_window);
                    }
                }

                if (DataSended == 57) //(57 写IO端口)
                {
                    try
                    {
                        WriteIO = 0x00;
                        switch (GB5_comboBox_OUT2写入.Text)
                        {
                            case "不写入":
                            case "notWrite":
                                WriteIO = 0x00;
                                break;
                            case "写入0":
                            case "Write0":
                                WriteIO = 0x40;
                                break;
                            case "写入1":
                            case "Write1":
                                WriteIO = 0x48;
                                break;
                            case "保持不变":
                            case "Hold IO":
                                WriteIO = 0x80;
                                break;
                        }

                        switch (GB5_comboBox_OUT1写入.Text)
                        {
                            case "不写入":
                            case "notWrite":
                                WriteIO |= 0x00;
                                break;
                            case "写入0":
                            case "Write0":
                                WriteIO |= 0x10;
                                break;
                            case "写入1":
                            case "Write1":
                                WriteIO |= 0x14;
                                break;
                            case "保持不变":
                            case "Hold IO":
                                WriteIO |= 0x20;
                                break;
                        }

                        tCHK = 0xFA + Addr + data + WriteIO;
                        Buffer = new byte[] { 0xFA, Addr, (byte)data, WriteIO, (byte)tCHK };
                        WriteByteToSerialPort(Buffer, 0, 5);
                    }
                    catch
                    {
                        MessageBox.Show(Text1_General, Text2_window);
                    }
                }

            }
            else
                MessageBox.Show(Text2_UartAddrError, Text1_window);
        }

        private void port_DataReceived(object sender, SerialDataReceivedEventArgs e) //串口接收事件
        {
            serialReceivedState = 1;
            if (DataSended == 54 || DataSended == 55)//接收长指令
                Thread.Sleep(5);
            SerialBuffer_RX = new byte[38] { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 }; //SerialBuffer_RX[0] 帧头 [1] 从机地址 [2] 指令编号
            Data_Number = serialPort1.BytesToRead; //接收的数据的位数
            if (serialPort1.BytesToRead > 0 && serialPort1.BytesToRead <= 38)
            {
                for (int a = 0; a <= Data_Number - 1; a++)
                {
                    SerialBuffer_RX[a] = (byte)serialPort1.ReadByte(); //从SerialPort输入缓冲区读一个字节
                }
                Text_display();
            }
            serialReceivedState = 0;
        }

        private void Text_display()
        {
            rxDisplay();  //输出数据，计算rCHK

            if ((byte)rCHK == SerialBuffer_RX[Data_Number - 1])
            {
                switch ( SerialBuffer_RX[2] )
                {
                    case 0x30: // 0 进位制编码器值 FB + 01 + 30 + int32_t进位值 + uint16_t编码器值 + CRC
                        readCount();
                        if (GB2_radioButton_十六进制.Checked) //十六进制
                        {
                            GB2_textBox_编码器值.Clear();

                            GB2_textBox_编码器值.AppendText("0x");
                            for (int a = 3; a < 9; a++)
                            {
                                str = Convert.ToString(SerialBuffer_RX[a], 16).ToUpper();
                                GB2_textBox_编码器值.AppendText(str.Length == 1 ? "0" + str : str);
                            }
                            GB4_2_textBox_电机状态.AppendText(Text1_Read + "(" + Temp2 + ")");
                        }
                        else if (GB2_radioButton_十进制.Checked) //十进制
                        {
                            GB2_textBox_编码器值.Clear();

                            word32 = "0";
                            for (int a = 3; a < 7; a++)
                            {
                                str = Convert.ToString(SerialBuffer_RX[a], 16).ToUpper();
                                word32 += str.Length == 1 ? "0" + str : str;
                            }
                            data32 = Convert.ToInt32(word32, 16);

                            word16 = "0";
                            for (int a = 7; a < 9; a++)
                            {
                                str = Convert.ToString(SerialBuffer_RX[a], 16).ToUpper();
                                word16 += str.Length == 1 ? "0" + str : str;
                            }
                            data16 = Convert.ToInt16(word16, 16);

                            str = Convert.ToString(data32 * 360 + data16 * 360 / 16384, 10);
                            GB2_textBox_编码器值.AppendText(str);
                            GB4_2_textBox_电机状态.AppendText(Text1_Read + "(" + Temp2 + ")");
                        }
                        else
                        {
                            GB4_2_textBox_电机状态.AppendText(Text2_Read + "(" + Temp2 + ")");
                            MessageBox.Show(Text1_window, Text2_window);
                        }
                        break;

                    case 0x33: // 1 输入累计脉冲数 FB + 01 + 33 + int32_t输入累计脉冲数 + CRC
                        readCount();
                        if (GB2_radioButton_十六进制.Checked)
                        {
                            GB2_textBox_脉冲数值.Clear();

                            GB2_textBox_脉冲数值.AppendText("0x");
                            for (int a = 3; a < 7; a++)
                            {
                                str = Convert.ToString(SerialBuffer_RX[a], 16).ToUpper();
                                GB2_textBox_脉冲数值.AppendText(str.Length == 1 ? "0" + str : str);
                            }
                            GB4_2_textBox_电机状态.AppendText(Text1_Read + "(" + Temp2 + ")");
                        }
                        else if (GB2_radioButton_十进制.Checked)
                        {
                            GB2_textBox_脉冲数值.Clear();

                            word32 = "0";
                            for (int a = 3; a < 7; a++)
                            {
                                str = Convert.ToString(SerialBuffer_RX[a], 16).ToUpper();
                                word32 += str.Length == 1 ? "0" + str : str;
                            }
                            data32 = Convert.ToInt32(word32, 16);

                            str = Convert.ToString(data32, 10);
                            GB2_textBox_脉冲数值.AppendText(str);
                            GB4_2_textBox_电机状态.AppendText(Text1_Read + "(" + Temp2 + ")");
                        }
                        else
                        {
                            GB4_2_textBox_电机状态.AppendText(Text2_Read + "(" + Temp2 + ")");
                            MessageBox.Show(Text1_window, Text2_window);
                        }
                        break;

                    case 0x39: // 2 位置角度误差 FB + 01 + 39 + int32_t位置角度误差 + CRC
                        readCount();
                        if (GB2_radioButton_十六进制.Checked)
                        {
                            GB2_textBox_误差值.Clear();
                            GB2_textBox_误差值.AppendText("0x");
                            if (FV1[2] == 0x01 || FV1[2] == 0x02)
                            {
                                for (int a = 3; a < 5; a++)
                                {
                                    str = Convert.ToString(SerialBuffer_RX[a], 16).ToUpper();
                                    GB2_textBox_误差值.AppendText(str.Length == 1 ? "0" + str : str);
                                }
                            }
                            else
                            {
                                for (int a = 3; a < 7; a++)
                                {
                                    str = Convert.ToString(SerialBuffer_RX[a], 16).ToUpper();
                                    GB2_textBox_误差值.AppendText(str.Length == 1 ? "0" + str : str);
                                }
                            }
                            GB4_2_textBox_电机状态.AppendText(Text1_Read + "(" + Temp2 + ")");
                        }
                        else if (GB2_radioButton_十进制.Checked)
                        {
                            GB2_textBox_误差值.Clear();
                            word32 = "0";
                            if (FV1[2] == 0x01 || FV1[2] == 0x02)
                            {
                                for (int a = 3; a < 5; a++)
                                {
                                    str = Convert.ToString(SerialBuffer_RX[a], 16).ToUpper();
                                    word32 += str.Length == 1 ? "0" + str : str;
                                }
                            }
                            else
                            {
                                for (int a = 3; a < 7; a++)
                                {
                                    str = Convert.ToString(SerialBuffer_RX[a], 16).ToUpper();
                                    word32 += str.Length == 1 ? "0" + str : str;
                                }
                            }
                            data32 = Convert.ToInt32(word32, 16);

                            str = Convert.ToString(data32, 10);
                            GB2_textBox_误差值.AppendText(str);
                            GB4_2_textBox_电机状态.AppendText(Text1_Read + "(" + Temp2 + ")");
                        }
                        else
                        {
                            GB4_2_textBox_电机状态.AppendText(Text2_Read + "(" + Temp2 + ")");
                            MessageBox.Show(Text1_window, Text2_window);
                        }
                        break;

                    case 0x3A: // 3 驱动板使能状态 FB + 01 + 3A + uint8_t闭环驱动板的使能状态 + CRC
                               //已使能：01
                               //没使能：00
                        readCount();
                        if (SerialBuffer_RX[3] == EN_STATE_ON)
                        {
                            GB2_textBox_使能状态.Clear();
                            GB2_textBox_使能状态.AppendText(Text1_EN);
                            GB4_2_textBox_电机状态.AppendText(Text1_Read + "(" + Temp2 + ")");
                        }
                        else if (SerialBuffer_RX[3] == EN_STATE_OFF)
                        {
                            GB2_textBox_使能状态.Clear();
                            GB2_textBox_使能状态.AppendText(Text2_EN);
                            GB4_2_textBox_电机状态.AppendText(Text1_Read + "(" + Temp2 + ")");
                        }
                        else
                        {
                            GB4_2_textBox_电机状态.AppendText(Text2_Read + "(" + Temp2 + ")");
                            MessageBox.Show(Text1_window, Text2_window);
                        }
                        break;

                    case 0x3B: // 4 上电自动回零状态 FB + 01 + 3B + uint8_t回零状态值 + CRC
                               //执行回零中：00
                               //回零成功：01
                               //回零失败：02
                        readCount();
                        if (SerialBuffer_RX[3] == 0x00)
                        {
                            GB2_textBox_回零状态.Clear();
                            GB2_textBox_回零状态.AppendText(Text1_Zero);
                            GB4_2_textBox_电机状态.AppendText(Text1_Read + "(" + Temp2 + ")");
                        }
                        else if (SerialBuffer_RX[3] == 0x01)
                        {
                            GB2_textBox_回零状态.Clear();
                            GB2_textBox_回零状态.AppendText(Text2_AutoZero);
                            GB4_2_textBox_电机状态.AppendText(Text1_Read + "(" + Temp2 + ")");
                        }
                        else if (SerialBuffer_RX[3] == 0x02)
                        {
                            GB2_textBox_回零状态.Clear();
                            GB2_textBox_回零状态.AppendText(Text3_AutoZero);
                            GB4_2_textBox_电机状态.AppendText(Text1_Read + "(" + Temp2 + ")");
                        }
                        else
                        {
                            GB4_2_textBox_电机状态.AppendText(Text2_Read + "(" + Temp2 + ")");
                            MessageBox.Show(Text1_window, Text2_window);
                        }
                        break;

                    case 0x3E: // 5 堵转标志位 FB + 01 + 3E + uint8_t堵转标志 + CRC
                               //堵转：01
                               //没堵转：00
                        readCount();
                        if (SerialBuffer_RX[3] == 0x01)
                        {
                            GB2_textBox_堵转状态.Clear();
                            GB2_textBox_堵转状态.AppendText(Text1_Stall);
                            GB4_2_textBox_电机状态.AppendText(Text1_Read + "(" + Temp2 + ")");
                        }
                        else if (SerialBuffer_RX[3] == 0x00)
                        {
                            GB2_textBox_堵转状态.Clear();
                            GB2_textBox_堵转状态.AppendText(Text2_Stall);
                            GB4_2_textBox_电机状态.AppendText(Text1_Read + "(" + Temp2 + ")");
                        }
                        else
                        {
                            GB4_2_textBox_电机状态.AppendText(Text2_Read + "(" + Temp2 + ")");
                            MessageBox.Show(Text1_window, Text2_window);
                        }
                        break;

                    case 0x3D: // 37 解除堵转状态
                             //解除成功 ：返回 FB 01 3D 01 3A
                             //解除失败 ：返回 FB 01 3D 00 39
                        if (SerialBuffer_RX[3] == 0x01)
                        {
                            MessageBox.Show(Text1_Block, Text1_Block);
                        }
                        else if (SerialBuffer_RX[3] == 0x00)
                        {
                            MessageBox.Show(Text2_Block, Text2_Block);
                        }
                        break;

                    case 0xF6: // 8 速度控制开始 & 9 速度控制停止
                        if (DataSended == 8)
                        {
                            GB4_2_textBox_电机状态.Clear();
                            if (SerialBuffer_RX[3] == 0x01) //成功
                            {
                                GB4_2_textBox_电机状态.AppendText(Text1_Move);
                            }
                            else if (SerialBuffer_RX[3] == 0x00) //失败
                            {
                                GB4_2_textBox_电机状态.AppendText(Text3_Move);
                                trackingMode.Stop();
                                break;
                            }
                            else
                            {
                                GB4_2_textBox_电机状态.AppendText(Text1_COM);
                                trackingMode.Stop();
                                break;
                            }
                            GB4_2_textBox_目标方向.Clear();
                            GB4_2_textBox_目标速度.Clear();
                            GB4_2_textBox_目标加速度.Clear();
                            if (GB4_3_radioButton_正转.Checked) //正转
                            {
                                GB4_2_textBox_目标方向.AppendText(Text1_Dir);
                            }
                            else if (GB4_3_radioButton_反转.Checked) //反转
                            {
                                GB4_2_textBox_目标方向.AppendText(Text2_Dir);
                            }
                            GB4_2_textBox_目标速度.AppendText(GB4_3_comboBox_速度档位.Text);
                            GB4_2_textBox_目标加速度.AppendText(Start_ACC[0].ToString());
                        }
                        else if (DataSended == 9)
                        {
                            GB4_2_textBox_电机状态.Clear();
                            if (SerialBuffer_RX[3] == 0x02) //完成
                            {
                                GB4_2_textBox_电机状态.AppendText(Text2_Stop);
                            }
                            else if (SerialBuffer_RX[3] == 0x01) //开始
                            {
                                GB4_2_textBox_电机状态.AppendText(Text4_Stop);
                            }
                            else if (SerialBuffer_RX[3] == 0x00) //失败
                            {
                                GB4_2_textBox_电机状态.AppendText(Text3_Stop);
                                trackingMode.Stop();
                                break;
                            }
                            else
                            {
                                GB4_2_textBox_电机状态.AppendText(Text1_COM);
                                trackingMode.Stop();
                                break;
                            }
                            GB4_2_textBox_目标方向.Clear();
                            GB4_2_textBox_目标速度.Clear();
                            GB4_2_textBox_目标加速度.Clear();
                            GB4_2_textBox_目标方向.AppendText(Text3_Dir);
                            GB4_2_textBox_目标速度.AppendText("0");
                            GB4_2_textBox_目标加速度.AppendText(Stop_ACC[0].ToString());
                        }
                        break;

                    case 0xFD: // 13 位置控制开始（相对脉冲） & 38 位置控制停止
                        GB4_2_textBox_电机状态.Clear();
                        GB4_2_textBox_目标方向.Clear();
                        GB4_2_textBox_目标速度.Clear();
                        GB4_2_textBox_目标加速度.Clear();
                        if (DataSended != 38)
                        {
                            if (SerialBuffer_RX[3] == 0x02) //完成
                            {
                                GB4_2_textBox_电机状态.AppendText(Text2_Move);
                                break;
                            }
                            else if (SerialBuffer_RX[3] == 0x01) //开始
                            {
                                GB4_2_textBox_电机状态.AppendText(Text4_Move);
                            }
                            else if (SerialBuffer_RX[3] == 0x00) //失败
                            {
                                GB4_2_textBox_电机状态.AppendText(Text3_Move);
                                trackingMode.Stop();
                                break;
                            }
                            else if (SerialBuffer_RX[3] == 0x03) //限位停止
                            {
                                GB4_2_textBox_电机状态.AppendText(Text5_Move);
                                break;
                            }
                            else
                            {
                                GB4_2_textBox_电机状态.AppendText(Text1_COM);
                                trackingMode.Stop();
                                break;
                            }
                            if (GB4_4_radioButton_正转.Checked) //正转
                            {
                                GB4_2_textBox_目标方向.AppendText(Text1_Dir);
                            }
                            else if (GB4_4_radioButton_反转.Checked) //反转
                            {
                                GB4_2_textBox_目标方向.AppendText(Text2_Dir);
                            }
                            GB4_2_textBox_目标速度.AppendText(GB4_4_comboBox_速度档位.Text);
                            GB4_2_textBox_目标加速度.AppendText(Start_ACC[0].ToString());
                        }
                        else if (DataSended == 38)
                        {
                            if (SerialBuffer_RX[3] == 0x02) //完成
                            {
                                GB4_2_textBox_电机状态.AppendText(Text2_Stop);
                                break;
                            }
                            else if (SerialBuffer_RX[3] == 0x01) //开始
                            {
                                GB4_2_textBox_电机状态.AppendText(Text4_Stop);
                            }
                            else if (SerialBuffer_RX[3] == 0x00) //失败
                            {
                                GB4_2_textBox_电机状态.AppendText(Text3_Stop);
                                trackingMode.Stop();
                                break;
                            }
                            else if (SerialBuffer_RX[3] == 0x03) //限位停止
                            {
                                GB4_2_textBox_电机状态.AppendText(Text5_Move);
                                break;
                            }
                            else
                            {
                                GB4_2_textBox_电机状态.AppendText(Text1_COM);
                                trackingMode.Stop();
                                break;
                            }
                            GB4_2_textBox_目标方向.AppendText(Text3_Dir);
                            GB4_2_textBox_目标速度.AppendText("0");
                            GB4_2_textBox_目标加速度.AppendText(Stop_ACC[0].ToString());
                        }
                        break;

                    case 0xFE: // 50 绝对脉冲 & 38 位置控制停止
                        GB4_2_textBox_电机状态.Clear();
                        GB4_2_textBox_目标方向.Clear();
                        GB4_2_textBox_目标速度.Clear();
                        GB4_2_textBox_目标加速度.Clear();
                        if (DataSended != 38)
                        {
                            if (SerialBuffer_RX[3] == 0x02) //完成
                            {
                                GB4_2_textBox_电机状态.AppendText(Text2_Move);
                                break;
                            }
                            else if (SerialBuffer_RX[3] == 0x01) //开始
                            {
                                GB4_2_textBox_电机状态.AppendText(Text4_Move);
                            }
                            else if (SerialBuffer_RX[3] == 0x00) //失败
                            {
                                GB4_2_textBox_电机状态.AppendText(Text3_Move);
                                trackingMode.Stop();
                                break;
                            }
                            else if (SerialBuffer_RX[3] == 0x03) //限位停止
                            {
                                GB4_2_textBox_电机状态.AppendText(Text5_Move);
                                break;
                            }
                            else
                            {
                                GB4_2_textBox_电机状态.AppendText(Text1_COM);
                                trackingMode.Stop();
                                break;
                            }
                            GB4_2_textBox_目标速度.AppendText(GB4_4_comboBox_速度档位.Text);
                            GB4_2_textBox_目标加速度.AppendText(Start_ACC[0].ToString());
                        }
                        else if (DataSended == 38)
                        {
                            if (SerialBuffer_RX[3] == 0x02) //完成
                            {
                                GB4_2_textBox_电机状态.AppendText(Text2_Stop);
                                break;
                            }
                            else if (SerialBuffer_RX[3] == 0x01) //开始
                            {
                                GB4_2_textBox_电机状态.AppendText(Text4_Stop);
                            }
                            else if (SerialBuffer_RX[3] == 0x00) //失败
                            {
                                GB4_2_textBox_电机状态.AppendText(Text3_Stop);
                                trackingMode.Stop();
                                break;
                            }
                            else if (SerialBuffer_RX[3] == 0x03) //限位停止
                            {
                                GB4_2_textBox_电机状态.AppendText(Text5_Move);
                                break;
                            }
                            else
                            {
                                GB4_2_textBox_电机状态.AppendText(Text1_COM);
                                trackingMode.Stop();
                                break;
                            }
                            GB4_2_textBox_目标方向.AppendText(Text3_Dir);
                            GB4_2_textBox_目标速度.AppendText("0");
                            GB4_2_textBox_目标加速度.AppendText(Stop_ACC[0].ToString());
                        }
                        break;

                    case 0xF4: // 44 相对坐标 & 38 位置控制停止
                        GB4_2_textBox_电机状态.Clear();
                        GB4_2_textBox_目标方向.Clear();
                        GB4_2_textBox_目标速度.Clear();
                        GB4_2_textBox_目标加速度.Clear();
                        if (DataSended != 38)
                        {
                            if (SerialBuffer_RX[3] == 0x02) //完成
                            {
                                GB4_2_textBox_电机状态.AppendText(Text2_Move);
                                break;
                            }
                            else if (SerialBuffer_RX[3] == 0x01) //开始
                            {
                                GB4_2_textBox_电机状态.AppendText(Text4_Move);
                            }
                            else if (SerialBuffer_RX[3] == 0x00) //失败
                            {
                                GB4_2_textBox_电机状态.AppendText(Text3_Move);
                                trackingMode.Stop();
                                break;
                            }
                            else if (SerialBuffer_RX[3] == 0x03) //限位停止
                            {
                                GB4_2_textBox_电机状态.AppendText(Text5_Move);
                                break;
                            }
                            else
                            {
                                GB4_2_textBox_电机状态.AppendText(Text1_COM);
                                trackingMode.Stop();
                                break;
                            }
                            GB4_2_textBox_目标速度.AppendText(GB4_4_comboBox_速度档位.Text);
                            GB4_2_textBox_目标加速度.AppendText(Start_ACC[0].ToString());
                        }
                        else if (DataSended == 38)
                        {
                            if (SerialBuffer_RX[3] == 0x02) //完成
                            {
                                GB4_2_textBox_电机状态.AppendText(Text2_Stop);
                                break;
                            }
                            else if (SerialBuffer_RX[3] == 0x01) //开始
                            {
                                GB4_2_textBox_电机状态.AppendText(Text4_Stop);
                            }
                            else if (SerialBuffer_RX[3] == 0x00) //失败
                            {
                                GB4_2_textBox_电机状态.AppendText(Text3_Stop);
                                trackingMode.Stop();
                                break;
                            }
                            else if (SerialBuffer_RX[3] == 0x03) //限位停止
                            {
                                GB4_2_textBox_电机状态.AppendText(Text5_Move);
                                break;
                            }
                            else
                            {
                                GB4_2_textBox_电机状态.AppendText(Text1_COM);
                                trackingMode.Stop();
                                break;
                            }
                            GB4_2_textBox_目标方向.AppendText(Text3_Dir);
                            GB4_2_textBox_目标速度.AppendText("0");
                            GB4_2_textBox_目标加速度.AppendText(Stop_ACC[0].ToString());
                        }
                        break;

                    case 0xF5: // 45 绝对坐标 & 38 位置控制停止
                        GB4_2_textBox_电机状态.Clear();
                        GB4_2_textBox_目标方向.Clear();
                        GB4_2_textBox_目标速度.Clear();
                        GB4_2_textBox_目标加速度.Clear();
                        if (DataSended != 38)
                        {
                            if (SerialBuffer_RX[3] == 0x02) //完成
                            {
                                GB4_2_textBox_电机状态.AppendText(Text2_Move);
                                break;
                            }
                            else if (SerialBuffer_RX[3] == 0x01) //开始
                            {
                                GB4_2_textBox_电机状态.AppendText(Text4_Move);
                            }
                            else if (SerialBuffer_RX[3] == 0x00) //失败
                            {
                                GB4_2_textBox_电机状态.AppendText(Text3_Move);
                                trackingMode.Stop();
                                break;
                            }
                            else if (SerialBuffer_RX[3] == 0x03) //限位停止
                            {
                                GB4_2_textBox_电机状态.AppendText(Text5_Move);
                                break;
                            }
                            else
                            {
                                GB4_2_textBox_电机状态.AppendText(Text1_COM);
                                trackingMode.Stop();
                                break;
                            }
                            GB4_2_textBox_目标速度.AppendText(GB4_4_comboBox_速度档位.Text);
                            GB4_2_textBox_目标加速度.AppendText(Start_ACC[0].ToString());
                        }
                        else if (DataSended == 38)
                        {
                            if (SerialBuffer_RX[3] == 0x02) //完成
                            {
                                GB4_2_textBox_电机状态.AppendText(Text2_Stop);
                                break;
                            }
                            else if (SerialBuffer_RX[3] == 0x01) //开始
                            {
                                GB4_2_textBox_电机状态.AppendText(Text4_Stop);
                            }
                            else if (SerialBuffer_RX[3] == 0x00) //失败
                            {
                                GB4_2_textBox_电机状态.AppendText(Text3_Stop);
                                trackingMode.Stop();
                                break;
                            }
                            else if (SerialBuffer_RX[3] == 0x03) //限位停止
                            {
                                GB4_2_textBox_电机状态.AppendText(Text5_Move);
                                break;
                            }
                            else
                            {
                                GB4_2_textBox_电机状态.AppendText(Text1_COM);
                                trackingMode.Stop();
                                break;
                            }
                            GB4_2_textBox_目标方向.AppendText(Text3_Dir);
                            GB4_2_textBox_目标速度.AppendText("0");
                            GB4_2_textBox_目标加速度.AppendText(Stop_ACC[0].ToString());
                        }
                        break;

                    case 0x31:// 39 累加制编码器值 FB + 01 + 31 + uint48_t编码器值 + CRC
                    case 0x35:// 58 原始累加制编码器值
                        readCount();
                        if (GB2_radioButton_十六进制.Checked) //十六进制
                        {
                            GB2_textBox_编码器值.Clear();

                            GB2_textBox_编码器值.AppendText("0x");
                            for (int a = 3; a < 9; a++)
                            {
                                str = Convert.ToString(SerialBuffer_RX[a], 16).ToUpper();
                                GB2_textBox_编码器值.AppendText(str.Length == 1 ? "0" + str : str);
                            }
                            GB4_2_textBox_电机状态.AppendText(Text1_Read + "(" + Temp2 + ")");
                        }
                        else if (GB2_radioButton_十进制.Checked) //十进制
                        {
                            GB2_textBox_编码器值.Clear();

                            word64 = "0";
                            for (int a = 3; a < 9; a++)
                            {
                                if (a == 3 && SerialBuffer_RX[3] >= 0x80)
                                {
                                    str = Convert.ToString(SerialBuffer_RX[a], 16).ToUpper();
                                    word64 = "FFFF" + str;
                                }
                                else
                                {
                                    str = Convert.ToString(SerialBuffer_RX[a], 16).ToUpper();
                                    word64 += str.Length == 1 ? "0" + str : str;
                                }
                            }
                            data64 = Convert.ToInt64(word64, 16);

                            str = Convert.ToString(data64 * 360 / 16384, 10);
                            GB2_textBox_编码器值.AppendText(str);
                            GB4_2_textBox_电机状态.AppendText(Text1_Read + "(" + Temp2 + ")");
                        }
                        else
                        {
                            GB4_2_textBox_电机状态.AppendText(Text2_Read + "(" + Temp2 + ")");
                            MessageBox.Show(Text1_window, Text2_window);
                        }
                        break;

                    case 0x32:// 40 电机实时转速
                        readCount();
                        if (GB2_radioButton_十六进制.Checked) //十六进制
                        {
                            GB2_textBox_当前转速.Clear();
                            GB2_textBox_当前转速.AppendText("0x");
                            for (int a = 3; a < 5; a++)
                            {
                                str = Convert.ToString(SerialBuffer_RX[a], 16).ToUpper();
                                GB2_textBox_当前转速.AppendText(str.Length == 1 ? "0" + str : str);
                            }
                            GB4_2_textBox_电机状态.AppendText(Text1_Read + "(" + Temp2 + ")");
                        }
                        else if (GB2_radioButton_十进制.Checked) //十进制
                        {
                            GB2_textBox_当前转速.Clear();
                            word16 = "0";
                            for (int a = 3; a < 5; a++)
                            {
                                str = Convert.ToString(SerialBuffer_RX[a], 16).ToUpper();
                                word16 += str.Length == 1 ? "0" + str : str;
                            }
                            data16 = Convert.ToInt16(word16, 16);
                            str = Convert.ToString(data16, 10);
                            GB2_textBox_当前转速.AppendText(str);
                            GB4_2_textBox_电机状态.AppendText(Text1_Read + "(" + Temp2 + ")");
                        }
                        else
                        {
                            GB4_2_textBox_电机状态.AppendText(Text2_Read + "(" + Temp2 + ")");
                            MessageBox.Show(Text1_window, Text2_window);
                        }
                        break;

                    case 0x80:// 14 校准编码器
                        GB4_2_textBox_目标方向.Clear();
                        GB4_2_textBox_目标速度.Clear();
                        GB4_2_textBox_目标加速度.Clear();
                        GB4_2_textBox_电机状态.Clear();
                        if (SerialBuffer_RX[3] == 0x00)
                        {
                            GB4_2_textBox_电机状态.AppendText(Text1_Cal);
                        }
                        else if (SerialBuffer_RX[3] == 0x01)
                        {
                            GB4_2_textBox_电机状态.AppendText(Text2_Cal);
                        }
                        else if (SerialBuffer_RX[3] == 0x02)
                        {
                            GB4_2_textBox_电机状态.AppendText(Text3_Cal);
                        }
                        break;

                    case 0x3F:// 36 恢复出厂配置
                    case 0x82:// 16 工作模式
                    case 0x83:// 17 电流值
                    case 0x84:// 12 细分设置
                    case 0x85:// 18 使能设置
                    case 0x86:// 19 电机方向
                    case 0x87:// 20 自动熄屏
                    case 0x88:// 21 堵转保护
                    case 0x89:// 22 细分插补
                    case 0x8A:// 23 串口波特率
                    case 0x8B:// 24 电机通信地址
                    case 0x8C:// 41 从机应答
                    case 0x8D:// 42 从机分组
                    case 0x90:// 31 限位参数
                    case 0xF3:// 6 使能驱动板 & 7 关闭驱动板
                    case 0xFF:// 10 开启上电自动运行 & 11 关闭上电自动运行
                    case 0x9B:// 47 保持电流-确认
                    case 0x8F:// 48 按键锁定-确认
                    case 0x9A:// 49 单圈回零
                    case 0x94:// 35 无限位开关回零
                    case 0x9E:// 51 限位重映射
                    case 0x9D:// 56 EN回零与位置保护
                    case 0x36:// 57 写IO端口
                        GB4_2_textBox_目标方向.Clear();
                        GB4_2_textBox_目标速度.Clear();
                        GB4_2_textBox_目标加速度.Clear();
                        GB4_2_textBox_电机状态.Clear();
                        try
                        {
                            Temp1++;
                            if (SerialBuffer_RX[3] == 0x00)
                            {
                                GB4_2_textBox_电机状态.AppendText(Text2_RX + "(" + Temp1 + ")");
                            }
                            else if (SerialBuffer_RX[3] == 0x01)
                            {
                                GB4_2_textBox_电机状态.AppendText(Text1_RX + "(" + Temp1 + ")");
                            }
                        }
                        catch
                        {
                            Temp1 = 0;
                        }
                        break;

                    case 0x91:// 32 限位归零
                        GB4_2_textBox_目标方向.Clear();
                        GB4_2_textBox_目标速度.Clear();
                        GB4_2_textBox_目标加速度.Clear();
                        GB4_2_textBox_电机状态.Clear();
                        if (SerialBuffer_RX[3] == 0x00)
                        {
                            GB4_2_textBox_电机状态.AppendText(Text3_Zero);
                        }
                        else if (SerialBuffer_RX[3] == 0x01)
                        {
                            GB4_2_textBox_电机状态.AppendText(Text1_Zero);
                        }
                        else if (SerialBuffer_RX[3] == 0x02)
                        {
                            GB4_2_textBox_电机状态.AppendText(Text2_Zero);
                        }
                        break;

                    case 0x92:// 33 直接归零
                        GB4_2_textBox_目标方向.Clear();
                        GB4_2_textBox_目标速度.Clear();
                        GB4_2_textBox_目标加速度.Clear();
                        GB4_2_textBox_电机状态.Clear();
                        if (SerialBuffer_RX[3] == 0x00)
                        {
                            GB4_2_textBox_电机状态.AppendText(Text3_Zero);
                        }
                        else if (SerialBuffer_RX[3] == 0x01)
                        {
                            GB4_2_textBox_电机状态.AppendText(Text2_Zero);
                        }
                        break;

                    case 0x40:// 43 版本信息
                        try
                        {
                            if ((SerialBuffer_RX[3] & 0x01) <= 8 && (SerialBuffer_RX[3] & 0x01) >= 1)
                            {
                                HV = HardVersion[SerialBuffer_RX[3] & 0x01];
                            }
                            else
                            {
                                HV = HardVersion[0];
                            }
                            FV = "V" + SerialBuffer_RX[4] + "." + SerialBuffer_RX[5] + "." + SerialBuffer_RX[6];
                            for (int a = 0; a < 3; a++)
                            {
                                FV1[a] = SerialBuffer_RX[a + 4];
                            }
                            if (DataSended == 43)
                            {
                                readCount();
                                GB4_2_textBox_电机状态.AppendText(Text1_Read + "(" + Temp2 + ")");
                                DataSended = 0;
                                MessageBox.Show(Text_HardVer + ":  " + HV + "\n" + Text_FirmVer + ":  " + FV, "Version");
                            }
                            if (SerialBuffer_RX[3] == 1 || SerialBuffer_RX[3] == 2)
                            {
                                Max_Current = 3000;
                                Text_CurrentError = Text_CurrentError42D;
                                GB3_comboBox_电流值.Items.Clear();
                                GB3_comboBox_电流值.Items.AddRange(CurrentText_42D);
                                GB5_comboBox_无限位回零电流.Items.Clear();
                                GB5_comboBox_无限位回零电流.Items.AddRange(CurrentText_42D);
                            }
                            else if (SerialBuffer_RX[3] == 3 || SerialBuffer_RX[3] == 4)
                            {
                                Max_Current = 5200;
                                Text_CurrentError = Text_CurrentError57D;
                                GB3_comboBox_电流值.Items.Clear();
                                GB3_comboBox_电流值.Items.AddRange(CurrentText_57D);
                                GB5_comboBox_无限位回零电流.Items.Clear();
                                GB5_comboBox_无限位回零电流.Items.AddRange(CurrentText_57D);
                            }
                            else
                            {
                                Max_Current = 3000;
                                Text_CurrentError = Text_CurrentError42D;
                                GB3_comboBox_电流值.Items.Clear();
                                GB3_comboBox_电流值.Items.AddRange(CurrentText_42D);
                                GB5_comboBox_无限位回零电流.Items.Clear();
                                GB5_comboBox_无限位回零电流.Items.AddRange(CurrentText_42D);
                            }
                        }
                        catch
                        {
                            if (DataSended == 43)
                            {
                                GB4_2_textBox_电机状态.AppendText(Text2_Read + "(" + Temp2 + ")");
                            }
                            MessageBox.Show(Text1_window, Text2_window);
                        }
                        break;

                    case 0x34:// 46 读取IO端口状态
                        byte[] IO = { SerialBuffer_RX[3] };
                        BitArray LimitIO = new BitArray(IO);
                        GB5_textBox_IN1.Text = LimitIO.Get(0) ? "H" : "L";
                        GB5_textBox_IN2.Text = LimitIO.Get(1) ? "H" : "L";
                        GB5_textBox_OUT1.Text = LimitIO.Get(2) ? "H" : "L";
                        GB5_textBox_OUT2.Text = LimitIO.Get(3) ? "H" : "L";
                        break;

                    case 0xF7:// 52 紧急停止
                        GB4_2_textBox_目标方向.Clear();
                        GB4_2_textBox_目标速度.Clear();
                        GB4_2_textBox_目标加速度.Clear();
                        GB4_2_textBox_电机状态.Clear();
                        if (SerialBuffer_RX[3] == 0x00)
                        {
                            GB4_2_textBox_电机状态.AppendText(Stop2_Emergency);
                        }
                        else if (SerialBuffer_RX[3] == 0x01)
                        {
                            GB4_2_textBox_电机状态.AppendText(Stop1_Emergency);
                        }
                        break;

                    case 0x41:// 53 复位重启电机
                        GB4_2_textBox_目标方向.Clear();
                        GB4_2_textBox_目标速度.Clear();
                        GB4_2_textBox_目标加速度.Clear();
                        GB4_2_textBox_电机状态.Clear();
                        if (SerialBuffer_RX[3] == 0x00)
                        {
                            GB4_2_textBox_电机状态.AppendText(Restart2_Motor);
                        }
                        else if (SerialBuffer_RX[3] == 0x01)
                        {
                            GB4_2_textBox_电机状态.AppendText(Restart1_Motor);
                        }
                        break;

                    case 0x47:// 54 读取所有配置参数
                        readCount();
                        if (SerialBuffer_RX[3] == 0xff)
                        {
                            GB4_2_textBox_电机状态.AppendText(Text2_Read + "(" + Temp2 + ")");
                        }
                        else if (Data_Number == 38)
                        {
                            switch (SerialBuffer_RX[3])// 工作模式
                            {
                                case 0x00:
                                    GB3_comboBox_工作模式.Text = "CR_OPEN";
                                    break;
                                case 0x01:
                                    GB3_comboBox_工作模式.Text = "CR_CLOSE";
                                    break;
                                case 0x02:
                                    GB3_comboBox_工作模式.Text = "CR_vFOC";
                                    break;
                                case 0x03:
                                    GB3_comboBox_工作模式.Text = "SR_OPEN";
                                    break;
                                case 0x04:
                                    GB3_comboBox_工作模式.Text = "SR_CLOSE";
                                    break;
                                case 0x05:
                                    GB3_comboBox_工作模式.Text = "SR_vFOC";
                                    break;
                            }

                            GB3_comboBox_电流值.Text = Convert.ToString((SerialBuffer_RX[4] << 8) + SerialBuffer_RX[5], 10);// 工作电流

                            switch (SerialBuffer_RX[6])// 保持电流
                            {
                                case 0x00:
                                    GB3_comboBox_保持电流.Text = "10%";
                                    break;
                                case 0x01:
                                    GB3_comboBox_保持电流.Text = "20%";
                                    break;
                                case 0x02:
                                    GB3_comboBox_保持电流.Text = "30%";
                                    break;
                                case 0x03:
                                    GB3_comboBox_保持电流.Text = "40%";
                                    break;
                                case 0x04:
                                    GB3_comboBox_保持电流.Text = "50%";
                                    break;
                                case 0x05:
                                    GB3_comboBox_保持电流.Text = "60%";
                                    break;
                                case 0x06:
                                    GB3_comboBox_保持电流.Text = "70%";
                                    break;
                                case 0x07:
                                    GB3_comboBox_保持电流.Text = "80%";
                                    break;
                                case 0x08:
                                    GB3_comboBox_保持电流.Text = "90%";
                                    break;
                            }

                            GB3_comboBox_细分设置.Text = Convert.ToString(SerialBuffer_RX[7], 10);// 工作细分

                            switch (SerialBuffer_RX[8])// En 有效电平
                            {
                                case 0x00:
                                    GB3_comboBox_使能设置.Text = "L";
                                    break;
                                case 0x01:
                                    GB3_comboBox_使能设置.Text = "H";
                                    break;
                                case 0x02:
                                    GB3_comboBox_使能设置.Text = "Hold";
                                    break;
                            }

                            switch (SerialBuffer_RX[9])// 电机方向
                            {
                                case 0x00:
                                    GB3_comboBox_电机方向.Text = "CW";
                                    break;
                                case 0x01:
                                    GB3_comboBox_电机方向.Text = "CCW";
                                    break;
                            }

                            switch (SerialBuffer_RX[10])// 自动熄屏
                            {
                                case 0x00:
                                    GB3_comboBox_自动熄屏.Text = "Disable";
                                    break;
                                case 0x01:
                                    GB3_comboBox_自动熄屏.Text = "Enable";
                                    break;
                            }

                            switch (SerialBuffer_RX[11])// 堵转保护
                            {
                                case 0x00:
                                    GB3_comboBox_堵转保护.Text = "Disable";
                                    break;
                                case 0x01:
                                    GB3_comboBox_堵转保护.Text = "Enable";
                                    break;
                            }

                            switch (SerialBuffer_RX[12])// 细分插补
                            {
                                case 0x00:
                                    GB3_comboBox_细分插补.Text = "Disable";
                                    break;
                                case 0x01:
                                    GB3_comboBox_细分插补.Text = "Enable";
                                    break;
                            }

                            switch (SerialBuffer_RX[13])// 波特率
                            {
                                case 0x01:
                                    GB3_comboBox_串口波特率.Text = "9600";
                                    break;
                                case 0x02:
                                    GB3_comboBox_串口波特率.Text = "19200";
                                    break;
                                case 0x03:
                                    GB3_comboBox_串口波特率.Text = "25000";
                                    break;
                                case 0x04:
                                    GB3_comboBox_串口波特率.Text = "38400";
                                    break;
                                case 0x05:
                                    GB3_comboBox_串口波特率.Text = "57600";
                                    break;
                                case 0x06:
                                    GB3_comboBox_串口波特率.Text = "115200";
                                    break;
                                case 0x07:
                                    GB3_comboBox_串口波特率.Text = "256000";
                                    break;
                            }

                            GB3_comboBox_通讯地址.Text = "0x" + (Convert.ToString(SerialBuffer_RX[14], 16).Length == 1 ? "0" : "") + Convert.ToString(SerialBuffer_RX[14], 16);// 从机地址

                            GB3_comboBox_从机分组.Text = "0x" + (Convert.ToString(SerialBuffer_RX[15], 16).Length == 1 ? "0" : "") + Convert.ToString(SerialBuffer_RX[15], 16);// 分组地址

                            switch (((SerialBuffer_RX[16] & 0x01) << 8) + (SerialBuffer_RX[17] & 0x01))// 应答方式
                            {
                                case 0x0101:
                                    GB3_comboBox_从机应答.Text = Respond_Text[0];
                                    break;
                                case 0x0001:
                                case 0x0000:
                                    GB3_comboBox_从机应答.Text = Respond_Text[1];
                                    break;
                                case 0x0100:
                                    GB3_comboBox_从机应答.Text = Respond_Text[2];
                                    break;
                            }

                            switch (SerialBuffer_RX[19])// 按键锁定
                            {
                                case 0x00:
                                    GB3_comboBox_按键锁定.Text = "UnLock";
                                    break;
                                case 0x01:
                                    GB3_comboBox_按键锁定.Text = "Lock";
                                    break;
                            }

                            switch (SerialBuffer_RX[20])// 限位触发电平
                            {
                                case 0x00:
                                    GB5_comboBox_触发电平.Text = "Low";
                                    break;
                                case 0x01:
                                    GB5_comboBox_触发电平.Text = "High";
                                    break;
                            }

                            switch (SerialBuffer_RX[21])// 限位方向
                            {
                                case 0x00:
                                    GB5_comboBox_归零方向.Text = "CW";
                                    break;
                                case 0x01:
                                    GB5_comboBox_归零方向.Text = "CCW";
                                    break;
                            }

                            GB5_comboBox_归零速度.Text = Convert.ToString((SerialBuffer_RX[22] << 8) + SerialBuffer_RX[23], 10);// 限位速度

                            switch (SerialBuffer_RX[24])// 限位使能
                            {
                                case 0x00:
                                    GB5_comboBox_归零使能.Text = "Disable";
                                    break;
                                case 0x01:
                                    GB5_comboBox_归零使能.Text = "Enable";
                                    break;
                            }

                            GB5_comboBox_无限位返回距离.Text = (Convert.ToString(SerialBuffer_RX[25], 16).Length == 1 ? "0" : "") + Convert.ToString(SerialBuffer_RX[25], 16)
                                + (Convert.ToString(SerialBuffer_RX[26], 16).Length == 1 ? "0" : "") + Convert.ToString(SerialBuffer_RX[26], 16)
                                + (Convert.ToString(SerialBuffer_RX[27], 16).Length == 1 ? "0" : "") + Convert.ToString(SerialBuffer_RX[27], 16)
                                + (Convert.ToString(SerialBuffer_RX[28], 16).Length == 1 ? "0" : "") + Convert.ToString(SerialBuffer_RX[28], 16);// 返回距离

                            switch (SerialBuffer_RX[29])// 回零模式
                            {
                                case 0x00:
                                    GB5_comboBox_无限位回零模式.Text = "Limit Home";
                                    break;
                                case 0x01:
                                    GB5_comboBox_无限位回零模式.Text = "noLimit Home";
                                    break;
                            }

                            GB5_comboBox_无限位回零电流.Text = Convert.ToString((SerialBuffer_RX[30] << 8) + SerialBuffer_RX[31], 10);// 回零电流

                            switch (SerialBuffer_RX[32])// 限位重映射
                            {
                                case 0x00:
                                    GB5_comboBox_限位重映射.Text = "Disable";
                                    break;
                                case 0x01:
                                    GB5_comboBox_限位重映射.Text = "Enable";
                                    break;
                            }

                            switch (SerialBuffer_RX[33])// 单圈回零模式
                            {
                                case 0x00:
                                    GB5_comboBox_回零模式.Text = "Disable";
                                    break;
                                case 0x01:
                                    GB5_comboBox_回零模式.Text = "DirMode";
                                    break;
                                case 0x02:
                                    GB5_comboBox_回零模式.Text = "NearMode";
                                    break;
                            }

                            GB5_comboBox_设置零点.Text = "Hold 0";// 单圈设置 0 点

                            GB5_comboBox_回零速度.Text = Convert.ToString(SerialBuffer_RX[35], 10);// 单圈回零速度

                            switch (SerialBuffer_RX[36])// 单圈回零方向
                            {
                                case 0x00:
                                    GB5_comboBox_回零方向.Text = "CW";
                                    break;
                                case 0x01:
                                    GB5_comboBox_回零方向.Text = "CCW";
                                    break;
                            }

                            GB5_comboBox_EN回零.SelectedIndex = -1;
                            GB5_comboBox_位置保护.SelectedIndex = -1;
                            GB5_comboBox_触发时间.SelectedIndex = -1;
                            GB5_comboBox_触发距离.SelectedIndex = -1;
                            GB5_comboBox_OUT2写入.SelectedIndex = -1;
                            GB5_comboBox_OUT1写入.SelectedIndex = -1;

                            GB4_2_textBox_电机状态.AppendText(Text1_Read + "(" + Temp2 + ")");
                            serialReceivedState = 0;
                            SendRelevantData(QueryCommand[++DataSended]);
                        }
                        break;

                    case 0x48:// 55 读取所有状态参数
                        readCount();
                        if (SerialBuffer_RX[3] == 0xff)
                        {
                            GB4_2_textBox_电机状态.AppendText(Text2_Read + "(" + Temp2 + ")");
                        }
                        else if (Data_Number == 31)
                        {
                            GB2_comboBox_读编码值.Text = Encoder_Text[1];
                            if (GB2_radioButton_十进制.Checked)
                            {
                                GB2_textBox_编码器值.Text = Convert.ToString((((SerialBuffer_RX[4] & 0x80) == 0x80 ? ((long)0xffff << 48) : 0)
                                    + ((long)SerialBuffer_RX[4] << 40)
                                    + ((long)SerialBuffer_RX[5] << 32)
                                    + ((long)SerialBuffer_RX[6] << 24)
                                    + ((long)SerialBuffer_RX[7] << 16)
                                    + ((long)SerialBuffer_RX[8] << 8)
                                    + SerialBuffer_RX[9]) * 360 / 16384, 10);// 编码器值

                                GB2_textBox_当前转速.Text = Convert.ToString((short)(SerialBuffer_RX[10] << 8)
                                    + SerialBuffer_RX[11], 10);// 实时转速

                                GB2_textBox_脉冲数值.Text = Convert.ToString((SerialBuffer_RX[12] << 24)
                                    + (SerialBuffer_RX[13] << 16)
                                    + (SerialBuffer_RX[14] << 8)
                                    + SerialBuffer_RX[15], 10);// 脉冲数

                                GB2_textBox_误差值.Text = Convert.ToString((SerialBuffer_RX[23] << 24)
                                    + (SerialBuffer_RX[24] << 16)
                                    + (SerialBuffer_RX[25] << 8)
                                    + SerialBuffer_RX[26], 10);// 角度误差
                            }
                            else
                            {
                                GB2_textBox_编码器值.Text = "0x"
                                + (Convert.ToString(SerialBuffer_RX[4], 16).Length == 1 ? "0" : "") + Convert.ToString(SerialBuffer_RX[4], 16)
                                + (Convert.ToString(SerialBuffer_RX[5], 16).Length == 1 ? "0" : "") + Convert.ToString(SerialBuffer_RX[5], 16)
                                + (Convert.ToString(SerialBuffer_RX[6], 16).Length == 1 ? "0" : "") + Convert.ToString(SerialBuffer_RX[6], 16)
                                + (Convert.ToString(SerialBuffer_RX[7], 16).Length == 1 ? "0" : "") + Convert.ToString(SerialBuffer_RX[7], 16)
                                + (Convert.ToString(SerialBuffer_RX[8], 16).Length == 1 ? "0" : "") + Convert.ToString(SerialBuffer_RX[8], 16)
                                + (Convert.ToString(SerialBuffer_RX[9], 16).Length == 1 ? "0" : "") + Convert.ToString(SerialBuffer_RX[9], 16);// 编码器值

                                GB2_textBox_当前转速.Text = "0x"
                                    + (Convert.ToString(SerialBuffer_RX[10], 16).Length == 1 ? "0" : "") + Convert.ToString(SerialBuffer_RX[10], 16)
                                    + (Convert.ToString(SerialBuffer_RX[11], 16).Length == 1 ? "0" : "") + Convert.ToString(SerialBuffer_RX[11], 16);// 实时转速

                                GB2_textBox_脉冲数值.Text = "0x"
                                    + (Convert.ToString(SerialBuffer_RX[12], 16).Length == 1 ? "0" : "") + Convert.ToString(SerialBuffer_RX[12], 16)
                                    + (Convert.ToString(SerialBuffer_RX[13], 16).Length == 1 ? "0" : "") + Convert.ToString(SerialBuffer_RX[13], 16)
                                    + (Convert.ToString(SerialBuffer_RX[14], 16).Length == 1 ? "0" : "") + Convert.ToString(SerialBuffer_RX[14], 16)
                                    + (Convert.ToString(SerialBuffer_RX[15], 16).Length == 1 ? "0" : "") + Convert.ToString(SerialBuffer_RX[15], 16);// 脉冲数

                                GB2_textBox_误差值.Text = "0x"
                                    + (Convert.ToString(SerialBuffer_RX[23], 16).Length == 1 ? "0" : "") + Convert.ToString(SerialBuffer_RX[23], 16)
                                    + (Convert.ToString(SerialBuffer_RX[24], 16).Length == 1 ? "0" : "") + Convert.ToString(SerialBuffer_RX[24], 16)
                                    + (Convert.ToString(SerialBuffer_RX[25], 16).Length == 1 ? "0" : "") + Convert.ToString(SerialBuffer_RX[25], 16)
                                    + (Convert.ToString(SerialBuffer_RX[26], 16).Length == 1 ? "0" : "") + Convert.ToString(SerialBuffer_RX[26], 16);// 角度误差
                            }

                            byte[] ReadIO = { SerialBuffer_RX[16] };
                            BitArray LimitReadIO = new BitArray(ReadIO);
                            GB5_textBox_IN1.Text = LimitReadIO.Get(0) ? "H" : "L";
                            GB5_textBox_IN2.Text = LimitReadIO.Get(1) ? "H" : "L";
                            GB5_textBox_OUT1.Text = LimitReadIO.Get(2) ? "H" : "L";
                            GB5_textBox_OUT2.Text = LimitReadIO.Get(3) ? "H" : "L";// IO 状态

                            switch (SerialBuffer_RX[27])// 使能状态
                            {
                                case 0x00:
                                    GB2_textBox_使能状态.Text = Text2_EN;
                                    break;
                                case 0x01:
                                    GB2_textBox_使能状态.Text = Text1_EN;
                                    break;
                            }

                            switch (SerialBuffer_RX[28])// 上电回零状态
                            {
                                case 0x00:
                                    GB2_textBox_回零状态.Text = Text1_Zero;
                                    break;
                                case 0x01:
                                    GB2_textBox_回零状态.Text = Text2_AutoZero;
                                    break;
                                case 0x02:
                                    GB2_textBox_回零状态.Text = Text3_AutoZero;
                                    break;
                            }

                            switch (SerialBuffer_RX[29])// 堵转状态
                            {
                                case 0x00:
                                    GB2_textBox_堵转状态.Text = Text2_Stall;
                                    break;
                                case 0x01:
                                    GB2_textBox_堵转状态.Text = Text1_Stall;
                                    break;
                            }
                            GB4_2_textBox_电机状态.AppendText(Text1_Read + "(" + Temp2 + ")");
                        }
                        break;

                    default:
                        MessageBox.Show(Text2_SerialError, Text2_window);
                        break;
                }
            }
        }

        private void readCount()
        {
            GB4_2_textBox_目标方向.Clear();
            GB4_2_textBox_目标速度.Clear();
            GB4_2_textBox_目标加速度.Clear();
            GB4_2_textBox_电机状态.Clear();
            try
            {
                Temp2++;
            }
            catch
            {
                Temp2 = 1;
            }
        }

        private void txDisplay()
        {
            if(txNotDisplay == 0)
            {
                Console.Write("TX: ");
                GB6_textBox_数据日志.AppendText(DateTime.Now + "\r\n");
                GB6_textBox_数据日志.AppendText("  TX: ");
                for (int a = 0; a < Buffer.Length; a++)
                {
                    Console.Write("{0:X2} ", Buffer[a]);
                    GB6_textBox_数据日志.AppendText(Buffer[a].ToString("X") + " ");
                }
                Console.WriteLine("Length: {0}", Buffer.Length);
                GB6_textBox_数据日志.AppendText("\r\n" + "\r\n");
            }
            txNotDisplay = 0;
        }

        private void rxDisplay()
        {
            rCHK = 0x00;
            for (int a = 0; a < Data_Number - 1; a++)
            {
                rCHK += SerialBuffer_RX[a];
            }

            if (rxNotDisplay == 0)
            {
                Console.Write("RX: ");
                GB6_textBox_数据日志.AppendText(DateTime.Now + "\r\n");
                GB6_textBox_数据日志.AppendText("  RX: ");
                for (int a = 0; a < Data_Number - 1; a++)
                {
                    Console.Write("{0:X2} ", SerialBuffer_RX[a]);
                    GB6_textBox_数据日志.AppendText(SerialBuffer_RX[a].ToString("X") + " ");
                }
                Console.WriteLine("{0:X2} rCHK: {1:X2} Length: {2}", SerialBuffer_RX[Data_Number - 1], (byte)rCHK, Data_Number);
                GB6_textBox_数据日志.AppendText(SerialBuffer_RX[Data_Number - 1].ToString("X") + "\r\n" + "\r\n");
            }
            rxNotDisplay = 0;
        }

        private void SearchAndAddSerialToComboBox(ComboBox MyBox)       //将可用端口号添加到ComboBox
        {
            MyBox.Items.Clear();
            string[] sAllPort = null;
            try
            {
                sAllPort = SerialPort.GetPortNames();                   //获取电脑上已连接的所有端口号
            }
            catch
            {
                MessageBox.Show("获取端口号失败", Text1_window);
            }
            for (int i = 0; i < sAllPort.Length; i++)
            {
                MyBox.Items.Add(sAllPort[i]);
            }
        }

        private void GetPortNames(object sender, EventArgs e)
        {
            SearchAndAddSerialToComboBox(GB1_comboBox_串口);       //扫描并讲课用串口添加至下拉列表
        }

        private void Form1_Load_1(object sender, EventArgs e) //启动程序-初始化设置
        {
            SearchAndAddSerialToComboBox(GB1_comboBox_串口);
            GB1_comboBox_波特率.Text = "38400";//波特率默认值
            GB1_comboBox_通讯地址.Text = "0x01";//地址
            GB4_3_comboBox_速度档位.Text = "0";//速度档位
            GB4_4_comboBox_速度档位.Text = "0";//速度档位
            GB4_1_comboBox_启动加速度.Text = "16";//启动加速度
            GB4_1_comboBox_停止加速度.Text = "16";//停止加速度
            GB4_4_textBox_脉冲数.Text = "0";//脉冲数
            GB4_4_comboBox_模式切换.Text = "RelPulses";//脉冲数模式
            GB2_radioButton_十六进制.Checked = true;
            GB4_3_radioButton_正转.Checked = true;
            GB4_4_radioButton_正转.Checked = true;
            /*****************语言默认************************/
            语言ToolStripMenuItem.Text = "Language/语言";
            F1_label_注意.Text = "Note: After clicking 'Restore parameter', you need to recalibrate again.";
            F1_button_恢复出厂配置.Text = "Restore parameter";
            F1_button_复位重启电机.Text = "Restart the motor";

            F1_groupBox1_连接设置.Text = "Connect Setting";
            GB1_label_串口.Text = "Port";
            GB1_label_波特率.Text = "Baud rate";
            GB1_label_通讯地址.Text = "Address";
            GB1_button_扫描.Text = "Scan";
            GB1_button_连接主板.Text = "Connect";
            GB1_button_断开连接.Text = "Disconnect";

            F1_groupBox2_读取参数.Text = "Read parameters";
            GB2_checkbox_跟踪模式.Text = "Tracking mode";
            GB2_radioButton_十六进制.Text = "Hex";
            GB2_radioButton_十进制.Text = "Decimal";
            GB2_button_读编码值.Text = "Read encoder";
            GB2_button_电机当前转速.Text = "Read motor RPM";
            GB2_button_累计脉冲数.Text = "Read pulses received";
            GB2_button_位置角度误差.Text = "Read angle error";
            GB2_button_使能状态.Text = "Read enable status";
            GB2_button_回零状态.Text = "Read auto 0 status";
            GB2_button_堵转标志位.Text = "Blocked status";
            GB2_button_解除堵转.Text = "Unblock";
            GB2_button_版本信息.Text = "About";
            GB2_button_读取所有参数.Text = "Read all parameters";
            Encoder_Text = Encoder_EN;
            GB2_comboBox_读编码值.Items.Clear();
            GB2_comboBox_读编码值.Items.AddRange(Encoder_Text);
            this.codeTip.SetToolTip(this.GB2_button_读编码值, "Carry encoder value: 0x30\r\nAddition encoder value: 0x31\r\nRaw encoder value: 0x35");

            F1_groupBox3_设置系统参数.Text = "Set system parameters";
            GB3_button_校准编码器.Text = "Cal";
            GB3_button_工作模式.Text = "Send";
            GB3_button_电流值.Text = "Send";
            GB3_button_细分设置.Text = "Send";
            GB3_button_使能设置.Text = "Send";
            GB3_button_电机方向.Text = "Send";
            GB3_button_自动熄屏.Text = "Send";
            GB3_button_堵转保护.Text = "Send";
            GB3_button_细分插补.Text = "Send";
            GB3_button_串口波特率.Text = "Send";
            GB3_button_通讯地址.Text = "Send";
            GB3_button_从机分组.Text = "Send";
            GB3_button_从机应答.Text = "Send";
            GB3_button_保持电流.Text = "Send";
            GB3_button_按键锁定.Text = "Send";
            GB3_label_工作模式.Text = "CtrMode";
            GB3_label_电流值.Text = "Ma";
            GB3_label_细分设置.Text = "MStep";
            GB3_label_使能设置.Text = "En";
            GB3_label_电机方向.Text = "Dir";
            GB3_label_自动熄屏.Text = "AutoSDD";
            GB3_label_堵转保护.Text = "Protect";
            GB3_label_细分插补.Text = "MPlyer";
            GB3_label_串口波特率.Text = "UartBaud";
            GB3_label_通讯地址.Text = "UartAddr";
            GB3_label_从机分组.Text = "UartGRP";
            GB3_label_从机应答.Text = "UartRSP";
            GB3_label_保持电流.Text = "Hold Ma";
            GB3_label_按键锁定.Text = "KeyLock";
            Respond_Text = Respond_EN;
            GB3_comboBox_从机应答.Items.Clear();
            GB3_comboBox_从机应答.Items.AddRange(Respond_Text);
            this.tipTip.SetToolTip(this.GB3_comboBox_细分设置, "Suggest setting MStep to the power of 2,\r\nas there may be errors in the position angle if it is not to the power of 2.");
            this.tipTip.SetToolTip(this.GB3_comboBox_工作模式, "CR: Serial port read and write parameters, pulse control motor motion.\r\n" +
                "SR: Serial port read and write parameters, serial port control motor motion.\r\n\r\n" +
                "OPEN: Open loop mode, no need to install magnets, constant current.\r\n" +
                "CLOSE: Closed loop mode, need to install magnets, constant current, high torque, suitable for use in situations where high torque or accuracy requirements are needed.\r\n" +
                "vFOC: FOC mode, need to install magnets, automatic current adjustment is not constant, motor noise is low, heat generation is low, and the upper limit of speed is high, \r\nbut the torque is lower compared to CLOSE mode.");

            F1_groupBox4_电机控制.Text = "Motor control";
            GB4_button_关闭驱动板.Text = "Disable motor";
            GB4_button_使能驱动板.Text = "Enable motor";
            GB4_button_紧急停止.Text = "Emergency stop";

            GB4_groupBox1_加速度参数.Text = "Acceleration parameter";
            GB4_1_button_启动加速度.Text = "OK";
            GB4_1_button_停止加速度.Text = "OK";
            GB4_1_label_启动加速度.Text = "Start ACC";
            GB4_1_label_停止加速度.Text = "Stop ACC";
            GB4_1_label_注意.Text = "Note: Please read the instructions carefully before modifying the parameters.";

            GB4_groupBox2_电机状态监控.Text = "Motor Status monitor";
            GB4_2_label_目标方向.Text = "Direction";
            GB4_2_label_目标速度.Text = "Speed";
            GB4_2_label_目标加速度.Text = "Acceleration";
            GB4_2_label_电机状态.Text = "Status";

            GB4_groupBox3_电机速度控制模式.Text = "Speed mode";
            GB4_3_radioButton_正转.Text = "Forward";
            GB4_3_radioButton_反转.Text = "Reverse";
            GB4_3_label_速度档位.Text = "Speed gear";
            GB4_3_label_提示.Text = "Tip: Speed gear range 1-3000";
            GB4_3_button_开始.Text = "Start";
            GB4_3_button_停止.Text = "Stop";
            GB4_3_button_开启上电自动运行.Text = "Save the parameter";
            GB4_3_button_关闭上电自动运行.Text = "Clean the parameter";

            GB4_groupBox4_电机位置控制模式.Text = "Position mode";
            GB4_4_radioButton_正转.Text = "Forward";
            GB4_4_radioButton_反转.Text = "Reverse";
            GB4_4_label_速度档位.Text = "Speed gear";
            GB4_4_label_脉冲数.Text = "Pulses";
            GB4_4_label_提示.Text = "Tip1: At 16 MStep, 3200 pulses = 360°.\nTip2: Axis range is -2147483647 to 2147483647 or 0x00 to 0xFFFFFFFF.";
            GB4_4_button_开始.Text = "Start";
            GB4_4_button_停止.Text = "Stop";
            GB4_4_comboBox_模式切换.Items.Clear();
            GB4_4_comboBox_模式切换.Items.AddRange(new object[] {
            "RelPulses",
            "AbsPulses",
            "RelAxis",
            "AbsAxis"});
            GB4_4_comboBox_模式切换.Text = "RelPulses";
            this.codeTip.SetToolTip(this.GB4_4_button_开始, "RelPulses: 0xFD\r\nAbsPulses: 0xFE\r\nRelAxis: 0xF4\r\nAbsAxis: 0xF5");
            this.codeTip.SetToolTip(this.GB4_4_button_停止, "RelPulses: 0xFD\r\nAbsPulses: 0xFE\r\nRelAxis: 0xF4\r\nAbsAxis: 0xF5");

            F1_groupBox5_设置限位参数.Text = "Limit setting";
            GB5_label_单圈回零.Text = "Auto  0";
            GB5_label_限位回零.Text = "Limit 0";
            GB5_label_回零模式.Text = "0 Mode";
            GB5_label_设置零点.Text = "Set 0";
            GB5_label_回零速度.Text = "0 Speed";
            GB5_label_回零方向.Text = "0 Dir";
            GB5_label_触发电平.Text = "HomeTrig";
            GB5_label_归零方向.Text = "HomeDir";
            GB5_label_归零速度.Text = "HomeSpeed";
            GB5_label_归零使能.Text = "EndLimit";
            GB5_label_无限位回零.Text = "noLimit 0";
            GB5_label_无限位返回距离.Text = "retValue";
            GB5_label_无限位回零模式.Text = "HomeMode";
            GB5_label_无限位回零电流.Text = "HomeMa";
            GB5_label_限位重映射.Location = new Point(510, 152);
            GB5_label_限位重映射.Text = "Limit remap";
            GB5_label_EN回零与位置保护.Font = new Font("宋体", 10.5F);
            GB5_label_EN回零与位置保护.Location = new Point(16, 185);
            GB5_label_EN回零与位置保护.Text = "EN 0 and\r\nPosition\r\nprotect";
            GB5_label_EN回零.Text = "g0Enable";
            GB5_label_位置保护.Text = "Enble";
            GB5_label_触发时间.Text = "Tim";
            GB5_label_触发距离.Text = "Errors";
            GB5_button_单圈回零.Text = "Send";
            GB5_button_限位参数.Text = "Send";
            GB5_button_读取IO端口.Text = "Read IO";
            GB5_button_限位归零.Text = "Go home";
            GB5_button_直接归零.Text = "Axis zero";
            GB5_button_无限位回零.Text = "Send";
            GB5_button_限位重映射.Text = "Send";
            GB5_button_EN回零与位置保护.Text = "Send";
            GB5_button_写IO端口.Text = "Write IO";
            WriteIO_Text = WriteIO_EN;
            GB5_comboBox_OUT2写入.Items.Clear();
            GB5_comboBox_OUT2写入.Items.AddRange(WriteIO_Text);
            GB5_comboBox_OUT1写入.Items.Clear();
            GB5_comboBox_OUT1写入.Items.AddRange(WriteIO_Text);

            F1_groupBox6_数据日志.Text = "Data log";

            Text1_Connect = ConnectText1[1];
            Text1_window = WindowText1[1];
            Text2_window = WindowText2[1];
            Text2_Connect = ConnectText2[1];
            Text1_SerialError = SerialErrorText1[1];
            Text2_SerialError = SerialErrorText2[1];
            Text1_Speedgear = Speedgear_Text1[1];
            Text1_SubdivisionError = SubdivisionError_Text1[1];
            Text1_PulseError = PulseError_Text1[1];
            Text2_PulseError = PulseError_Text2[1];
            Text1_UartAddrError = UartAddrError_Text1[1];
            Text2_UartAddrError = UartAddrError_Text2[1];
            Text1_DataError = DataError_Text1[1];
            Text_CurrentError42D = CurrentError42D_Text[1];
            Text_CurrentError57D = CurrentError57D_Text[1];
            Text1_EN = EN_Text1[1];
            Text2_EN = EN_Text2[1];
            Text1_Zero = Zero_Text1[1];
            Text2_Zero = Zero_Text2[1];
            Text3_Zero = Zero_Text3[1];
            Text2_AutoZero = AutoZero_Text2[1];
            Text3_AutoZero = AutoZero_Text3[1];
            Text1_Block = Block_Text1[1];
            Text2_Block = Block_Text2[1];
            Text1_Stall = Stall_Text1[1];
            Text2_Stall = Stall_Text2[1];
            Text1_General = General_Text1[1];
            Text2_General = General_Text2[1];
            Text1_Dir = Dir_Text1[1];
            Text2_Dir = Dir_Text2[1];
            Text3_Dir = Dir_Text3[1];
            Text1_Move = Move_Text1[1];
            Text2_Move = Move_Text2[1];
            Text3_Move = Move_Text3[1];
            Text4_Move = Move_Text4[1];
            Text5_Move = Move_Text5[1];
            Text1_Stop = Stop_Text1[1];
            Text2_Stop = Stop_Text2[1];
            Text3_Stop = Stop_Text3[1];
            Text4_Stop = Stop_Text4[1];
            Text1_COM = COM_Text1[1];
            Text1_Cal = Cal_Text1[1];
            Text2_Cal = Cal_Text2[1];
            Text3_Cal = Cal_Text3[1];
            Text1_RX = RX_Text1[1];
            Text2_RX = RX_Text2[1];
            Text1_Read = Read_Text1[1];
            Text2_Read = Read_Text2[1];
            Text_HardVer = HardVer_Text[1];
            Text_FirmVer = FirmVer_Text[1];
            Text1_AxisError = AxisError_Text1[1];
            Stop1_Emergency = Emergency_Stop1[1];
            Stop2_Emergency = Emergency_Stop2[1];
            Restart1_Motor = Motor_Restart1[1];
            Restart2_Motor = Motor_Restart2[1];
            /*****************非常重要************************/
            serialPort1.DataReceived += new SerialDataReceivedEventHandler(port_DataReceived);//添加一个事件,当串口接收数据时，触发该事件。
        }

        private void 中文ToolStripMenuItem_Click_1(object sender, EventArgs e) //中文文本
        {
            语言ToolStripMenuItem.Text = "语言/Language";
            F1_label_注意.Text = "注意：点击“恢复出厂设置”后需要重新校准。";
            F1_button_恢复出厂配置.Text = "恢复出厂配置";
            F1_button_复位重启电机.Text = "复位重启电机";

            F1_groupBox1_连接设置.Text = "连接设置";
            GB1_label_串口.Text = "串  口";
            GB1_label_波特率.Text = "波特率";
            GB1_label_通讯地址.Text = "通讯地址";
            GB1_button_扫描.Text = "扫描";
            GB1_button_连接主板.Text = "连接主板";
            GB1_button_断开连接.Text = "断开连接";

            F1_groupBox2_读取参数.Text = "读取参数";
            GB2_checkbox_跟踪模式.Text = "跟踪模式";
            GB2_radioButton_十六进制.Text = "十六进制";
            GB2_radioButton_十进制.Text = "十进制";
            GB2_button_读编码值.Text = "读编码器值";
            GB2_button_电机当前转速.Text = "电机当前转速";
            GB2_button_累计脉冲数.Text = "输入累计脉冲数";
            GB2_button_位置角度误差.Text = "位置角度误差";
            GB2_button_使能状态.Text = "驱动板使能状态";
            GB2_button_回零状态.Text = "上电自动回零状态";
            GB2_button_堵转标志位.Text = "堵转标志位";
            GB2_button_解除堵转.Text = "解除堵转";
            GB2_button_版本信息.Text = "读取版本信息";
            GB2_button_读取所有参数.Text = "读取所有参数";
            Encoder_Text = Encoder_CN;
            GB2_comboBox_读编码值.Items.Clear();
            GB2_comboBox_读编码值.Items.AddRange(Encoder_Text);
            this.codeTip.SetToolTip(this.GB2_button_读编码值, "进位编码器值：0x30\r\n累加编码器值：0x31\r\n原始累加编码器值：0x35");

            F1_groupBox3_设置系统参数.Text = "设置系统参数";
            GB3_button_校准编码器.Text = "校准编码器";
            GB3_button_工作模式.Text = "确认";
            GB3_button_电流值.Text = "确认";
            GB3_button_细分设置.Text = "确认";
            GB3_button_使能设置.Text = "确认";
            GB3_button_电机方向.Text = "确认";
            GB3_button_自动熄屏.Text = "确认";
            GB3_button_堵转保护.Text = "确认";
            GB3_button_细分插补.Text = "确认";
            GB3_button_串口波特率.Text = "确认";
            GB3_button_通讯地址.Text = "确认";
            GB3_button_从机分组.Text = "确认";
            GB3_button_从机应答.Text = "确认";
            GB3_button_保持电流.Text = "确认";
            GB3_button_按键锁定.Text = "确认";
            GB3_label_工作模式.Text = "工作模式";
            GB3_label_电流值.Text = "电流值(mA)";
            GB3_label_细分设置.Text = "细分设置";
            GB3_label_使能设置.Text = "使能设置";
            GB3_label_电机方向.Text = "电机方向";
            GB3_label_自动熄屏.Text = "自动熄屏";
            GB3_label_堵转保护.Text = "堵转保护";
            GB3_label_细分插补.Text = "细分插补";
            GB3_label_串口波特率.Text = "串口波特率";
            GB3_label_通讯地址.Text = "通讯地址";
            GB3_label_从机分组.Text = "从机分组";
            GB3_label_从机应答.Text = "从机应答";
            GB3_label_保持电流.Text = "保持电流";
            GB3_label_按键锁定.Text = "按键锁定";
            Respond_Text = Respond_CN;
            GB3_comboBox_从机应答.Items.Clear();
            GB3_comboBox_从机应答.Items.AddRange(Respond_Text);
            this.tipTip.SetToolTip(this.GB3_comboBox_细分设置, "建议细分数设置为2的次方，如果设置值为非2的次方，位置角度会有误差");
            this.tipTip.SetToolTip(this.GB3_comboBox_工作模式, "CR：串口读写参数，脉冲控制运动\r\n" +
                "SR：串口读写参数，串口控制运动\r\n\r\n" +
                "OPEN：开环模式，无需安装磁铁，电流恒定\r\n" +
                "CLOSE：闭环模式，需要安装磁铁，电流恒定，刚性度高，适合对力矩或精度要求较高的情况下使用\r\n" +
                "vFOC：FOC模式，需要安装磁铁，电流自动调节不恒定，电机噪音小，发热低，转速上限高，但刚性度相比CLOSE模式低");

            F1_groupBox4_电机控制.Text = "电机控制";
            GB4_button_关闭驱动板.Text = "关闭驱动板";
            GB4_button_使能驱动板.Text = "使能驱动板";
            GB4_button_紧急停止.Text = "紧急停止";

            GB4_groupBox1_加速度参数.Text = "加速度参数 ACC";
            GB4_1_button_启动加速度.Text = "确认";
            GB4_1_button_停止加速度.Text = "确认";
            GB4_1_label_启动加速度.Text = "启动加速度";
            GB4_1_label_停止加速度.Text = "停止加速度";
            GB4_1_label_注意.Text = "注意:请仔细阅读使用说明书中的加速度参数相关说明后再进行修改。";

            GB4_groupBox2_电机状态监控.Text = "电机状态监控";
            GB4_2_label_目标方向.Text = "目标方向";
            GB4_2_label_目标速度.Text = "目标速度";
            GB4_2_label_目标加速度.Text = "目标加速度";
            GB4_2_label_电机状态.Text = "电机状态";

            GB4_groupBox3_电机速度控制模式.Text = "电机速度控制模式";
            GB4_3_radioButton_正转.Text = "正转";
            GB4_3_radioButton_反转.Text = "反转";
            GB4_3_label_速度档位.Text = "速度档位";
            GB4_3_label_提示.Text = "提示：速度档位范围1-3000";
            GB4_3_button_开始.Text = "开始";
            GB4_3_button_停止.Text = "停止";
            GB4_3_button_开启上电自动运行.Text = "开启上电自动运行";
            GB4_3_button_关闭上电自动运行.Text = "关闭上电自动运行";

            GB4_groupBox4_电机位置控制模式.Text = "电机位置控制模式";
            GB4_4_radioButton_正转.Text = "正转";
            GB4_4_radioButton_反转.Text = "反转";
            GB4_4_label_速度档位.Text = "速度档位";
            GB4_4_label_脉冲数.Text = "脉冲数";
            GB4_4_label_提示.Text = "提示1：在16细分时，3200脉冲 = 360°。\n提示2：坐标取值范围为 -2147483647到2147483647 或 0x00到0xFFFFFFFF。";
            GB4_4_button_开始.Text = "开始";
            GB4_4_button_停止.Text = "停止";
            GB4_4_comboBox_模式切换.Items.Clear();
            GB4_4_comboBox_模式切换.Items.AddRange(new object[] {
            "相对脉冲数",
            "绝对脉冲数",
            "相对坐标",
            "绝对坐标"});
            GB4_4_comboBox_模式切换.Text = "相对脉冲数";
            this.codeTip.SetToolTip(this.GB4_4_button_开始, "相对脉冲：0xFD\r\n绝对脉冲：0xFE\r\n相对坐标：0xF4\r\n绝对坐标：0xF5");
            this.codeTip.SetToolTip(this.GB4_4_button_停止, "相对脉冲：0xFD\r\n绝对脉冲：0xFE\r\n相对坐标：0xF4\r\n绝对坐标：0xF5");

            F1_groupBox5_设置限位参数.Text = "设置限位参数";
            GB5_label_单圈回零.Text = "上电回零";
            GB5_label_限位回零.Text = "限位回零";
            GB5_label_回零模式.Text = "回零模式";
            GB5_label_设置零点.Text = "设置零点";
            GB5_label_回零速度.Text = "回零速度";
            GB5_label_回零方向.Text = "回零方向";
            GB5_label_触发电平.Text = "触发电平";
            GB5_label_归零方向.Text = "限位方向";
            GB5_label_归零速度.Text = "限位速度";
            GB5_label_归零使能.Text = "限位使能";
            GB5_label_无限位回零.Text = "无限位回零";
            GB5_label_无限位返回距离.Text = "返回距离";
            GB5_label_无限位回零模式.Text = "回零模式";
            GB5_label_无限位回零电流.Text = "回零电流(mA)";
            GB5_label_限位重映射.Location = new Point(525, 152);
            GB5_label_限位重映射.Text = "限位重映射";
            GB5_label_EN回零与位置保护.Font = new Font("宋体", 12.5F);
            GB5_label_EN回零与位置保护.Location = new Point(14, 190);
            GB5_label_EN回零与位置保护.Text = "EN回零与\r\n位置保护";
            GB5_label_EN回零.Text = "EN回零";
            GB5_label_位置保护.Text = "位置保护";
            GB5_label_触发时间.Text = "触发时间";
            GB5_label_触发距离.Text = "触发距离";
            GB5_button_单圈回零.Text = "确认";
            GB5_button_限位参数.Text = "确认";
            GB5_button_读取IO端口.Text = "读取IO端口";
            GB5_button_限位归零.Text = "限位归零";
            GB5_button_直接归零.Text = "直接归零";
            GB5_button_无限位回零.Text = "确认";
            GB5_button_限位重映射.Text = "确认";
            GB5_button_EN回零与位置保护.Text = "确认";
            GB5_button_写IO端口.Text = "写IO端口";
            WriteIO_Text = WriteIO_CN;
            GB5_comboBox_OUT2写入.Items.Clear();
            GB5_comboBox_OUT2写入.Items.AddRange(WriteIO_Text);
            GB5_comboBox_OUT1写入.Items.Clear();
            GB5_comboBox_OUT1写入.Items.AddRange(WriteIO_Text);

            F1_groupBox6_数据日志.Text = "数据日志";

            Text1_Connect = ConnectText1[0];
            Text2_Connect = ConnectText2[0];
            Text1_window = WindowText1[0];
            Text2_window = WindowText2[0];
            Text1_SerialError = SerialErrorText1[0];
            Text2_SerialError = SerialErrorText2[0];
            Text1_Speedgear = Speedgear_Text1[0];
            Text1_SubdivisionError = SubdivisionError_Text1[0];
            Text1_PulseError = PulseError_Text1[0];
            Text2_PulseError = PulseError_Text2[0];
            Text1_UartAddrError = UartAddrError_Text1[0];
            Text2_UartAddrError = UartAddrError_Text2[0];
            Text1_DataError = DataError_Text1[0];
            Text_CurrentError42D = CurrentError42D_Text[0];
            Text_CurrentError57D = CurrentError57D_Text[0];
            Text1_EN = EN_Text1[0];
            Text2_EN = EN_Text2[0];
            Text1_Zero = Zero_Text1[0];
            Text2_Zero = Zero_Text2[0];
            Text3_Zero = Zero_Text3[0];
            Text2_AutoZero = AutoZero_Text2[0];
            Text3_AutoZero = AutoZero_Text3[0];
            Text1_Block = Block_Text1[0];
            Text2_Block = Block_Text2[0];
            Text1_Stall = Stall_Text1[0];
            Text2_Stall = Stall_Text2[0];
            Text1_General = General_Text1[0];
            Text2_General = General_Text2[0];
            Text1_Dir = Dir_Text1[0];
            Text2_Dir = Dir_Text2[0];
            Text3_Dir = Dir_Text3[0];
            Text1_Move = Move_Text1[0];
            Text2_Move = Move_Text2[0];
            Text3_Move = Move_Text3[0];
            Text4_Move = Move_Text4[0];
            Text5_Move = Move_Text5[0];
            Text1_Stop = Stop_Text1[0];
            Text2_Stop = Stop_Text2[0];
            Text3_Stop = Stop_Text3[0];
            Text4_Stop = Stop_Text4[0];
            Text1_COM = COM_Text1[0];
            Text1_Cal = Cal_Text1[0];
            Text2_Cal = Cal_Text2[0];
            Text3_Cal = Cal_Text3[0];
            Text1_RX = RX_Text1[0];
            Text2_RX = RX_Text2[0];
            Text1_Read = Read_Text1[0];
            Text2_Read = Read_Text2[0];
            Text_HardVer = HardVer_Text[0];
            Text_FirmVer = FirmVer_Text[0];
            Text1_AxisError = AxisError_Text1[0];
            Stop1_Emergency = Emergency_Stop1[0];
            Stop2_Emergency = Emergency_Stop2[0];
            Restart1_Motor = Motor_Restart1[0];
            Restart2_Motor = Motor_Restart2[0];
        }

        private void englishToolStripMenuItem_Click(object sender, EventArgs e) //英文文本
        {
            语言ToolStripMenuItem.Text = "Language/语言";
            F1_label_注意.Text = "Note: After clicking 'Restore parameter', you need to recalibrate again.";
            F1_button_恢复出厂配置.Text = "Restore parameter";
            F1_button_复位重启电机.Text = "Restart the motor";

            F1_groupBox1_连接设置.Text = "Connect Setting";
            GB1_label_串口.Text = "Port";
            GB1_label_波特率.Text = "Baud rate";
            GB1_label_通讯地址.Text = "Address";
            GB1_button_扫描.Text = "Scan";
            GB1_button_连接主板.Text = "Connect";
            GB1_button_断开连接.Text = "Disconnect";

            F1_groupBox2_读取参数.Text = "Read parameters";
            GB2_checkbox_跟踪模式.Text = "Tracking mode";
            GB2_radioButton_十六进制.Text = "Hex";
            GB2_radioButton_十进制.Text = "Decimal";
            GB2_button_读编码值.Text = "Read encoder";
            GB2_button_电机当前转速.Text = "Read motor RPM";
            GB2_button_累计脉冲数.Text = "Read pulses received";
            GB2_button_位置角度误差.Text = "Read angle error";
            GB2_button_使能状态.Text = "Read enable status";
            GB2_button_回零状态.Text = "Read auto 0 status";
            GB2_button_堵转标志位.Text = "Blocked status";
            GB2_button_解除堵转.Text = "Unblock";
            GB2_button_版本信息.Text = "About";
            GB2_button_读取所有参数.Text = "Read all parameters";
            Encoder_Text = Encoder_EN;
            GB2_comboBox_读编码值.Items.Clear();
            GB2_comboBox_读编码值.Items.AddRange(Encoder_Text);
            this.codeTip.SetToolTip(this.GB2_button_读编码值, "Carry encoder value: 0x30\r\nAddition encoder value: 0x31\r\nRaw encoder value: 0x35");

            F1_groupBox3_设置系统参数.Text = "Set system parameters";
            GB3_button_校准编码器.Text = "Cal";
            GB3_button_工作模式.Text = "Send";
            GB3_button_电流值.Text = "Send";
            GB3_button_细分设置.Text = "Send";
            GB3_button_使能设置.Text = "Send";
            GB3_button_电机方向.Text = "Send";
            GB3_button_自动熄屏.Text = "Send";
            GB3_button_堵转保护.Text = "Send";
            GB3_button_细分插补.Text = "Send";
            GB3_button_串口波特率.Text = "Send";
            GB3_button_通讯地址.Text = "Send";
            GB3_button_从机分组.Text = "Send";
            GB3_button_从机应答.Text = "Send";
            GB3_button_保持电流.Text = "Send";
            GB3_button_按键锁定.Text = "Send";
            GB3_label_工作模式.Text = "CtrMode";
            GB3_label_电流值.Text = "Ma";
            GB3_label_细分设置.Text = "MStep";
            GB3_label_使能设置.Text = "En";
            GB3_label_电机方向.Text = "Dir";
            GB3_label_自动熄屏.Text = "AutoSDD";
            GB3_label_堵转保护.Text = "Protect";
            GB3_label_细分插补.Text = "MPlyer";
            GB3_label_串口波特率.Text = "UartBaud";
            GB3_label_通讯地址.Text = "UartAddr";
            GB3_label_从机分组.Text = "UartGRP";
            GB3_label_从机应答.Text = "UartRSP";
            GB3_label_保持电流.Text = "Hold Ma";
            GB3_label_按键锁定.Text = "KeyLock";
            Respond_Text = Respond_EN;
            GB3_comboBox_从机应答.Items.Clear();
            GB3_comboBox_从机应答.Items.AddRange(Respond_Text);
            this.tipTip.SetToolTip(this.GB3_comboBox_细分设置, "Suggest setting MStep to the power of 2,\r\nas there may be errors in the position angle if it is not to the power of 2.");
            this.tipTip.SetToolTip(this.GB3_comboBox_工作模式, "CR: Serial port read and write parameters, pulse control motor motion.\r\n" +
                "SR: Serial port read and write parameters, serial port control motor motion.\r\n\r\n" +
                "OPEN: Open loop mode, no need to install magnets, constant current.\r\n" +
                "CLOSE: Closed loop mode, need to install magnets, constant current, high torque, suitable for use in situations where high torque or accuracy requirements are needed.\r\n" +
                "vFOC: FOC mode, need to install magnets, automatic current adjustment is not constant, motor noise is low, heat generation is low, and the upper limit of speed is high, \r\nbut the torque is lower compared to CLOSE mode.");

            F1_groupBox4_电机控制.Text = "Motor control";
            GB4_button_关闭驱动板.Text = "Disable motor";
            GB4_button_使能驱动板.Text = "Enable motor";
            GB4_button_紧急停止.Text = "Emergency stop";

            GB4_groupBox1_加速度参数.Text = "Acceleration parameter";
            GB4_1_button_启动加速度.Text = "OK";
            GB4_1_button_停止加速度.Text = "OK";
            GB4_1_label_启动加速度.Text = "Start ACC";
            GB4_1_label_停止加速度.Text = "Stop ACC";
            GB4_1_label_注意.Text = "Note: Please read the instructions carefully before modifying the parameters.";

            GB4_groupBox2_电机状态监控.Text = "Motor Status monitor";
            GB4_2_label_目标方向.Text = "Direction";
            GB4_2_label_目标速度.Text = "Speed";
            GB4_2_label_目标加速度.Text = "Acceleration";
            GB4_2_label_电机状态.Text = "Status";

            GB4_groupBox3_电机速度控制模式.Text = "Speed mode";
            GB4_3_radioButton_正转.Text = "Forward";
            GB4_3_radioButton_反转.Text = "Reverse";
            GB4_3_label_速度档位.Text = "Speed gear";
            GB4_3_label_提示.Text = "Tip: Speed gear range 1-3000";
            GB4_3_button_开始.Text = "Start";
            GB4_3_button_停止.Text = "Stop";
            GB4_3_button_开启上电自动运行.Text = "Save the parameter";
            GB4_3_button_关闭上电自动运行.Text = "Clean the parameter";

            GB4_groupBox4_电机位置控制模式.Text = "Position mode";
            GB4_4_radioButton_正转.Text = "Forward";
            GB4_4_radioButton_反转.Text = "Reverse";
            GB4_4_label_速度档位.Text = "Speed gear";
            GB4_4_label_脉冲数.Text = "Pulses";
            GB4_4_label_提示.Text = "Tip1: At 16 MStep, 3200 pulses = 360°.\nTip2: Axis range is -2147483647 to 2147483647 or 0x00 to 0xFFFFFFFF.";
            GB4_4_button_开始.Text = "Start";
            GB4_4_button_停止.Text = "Stop";
            GB4_4_comboBox_模式切换.Items.Clear();
            GB4_4_comboBox_模式切换.Items.AddRange(new object[] {
            "RelPulses",
            "AbsPulses",
            "RelAxis",
            "AbsAxis"});
            GB4_4_comboBox_模式切换.Text = "RelPulses";
            this.codeTip.SetToolTip(this.GB4_4_button_开始, "RelPulses: 0xFD\r\nAbsPulses: 0xFE\r\nRelAxis: 0xF4\r\nAbsAxis: 0xF5");
            this.codeTip.SetToolTip(this.GB4_4_button_停止, "RelPulses: 0xFD\r\nAbsPulses: 0xFE\r\nRelAxis: 0xF4\r\nAbsAxis: 0xF5");

            F1_groupBox5_设置限位参数.Text = "Limit setting";
            GB5_label_单圈回零.Text = "Auto  0";
            GB5_label_限位回零.Text = "Limit 0";
            GB5_label_回零模式.Text = "0 Mode";
            GB5_label_设置零点.Text = "Set 0";
            GB5_label_回零速度.Text = "0 Speed";
            GB5_label_回零方向.Text = "0 Dir";
            GB5_label_触发电平.Text = "HomeTrig";
            GB5_label_归零方向.Text = "HomeDir";
            GB5_label_归零速度.Text = "HomeSpeed";
            GB5_label_归零使能.Text = "EndLimit";
            GB5_label_无限位回零.Text = "noLimit 0";
            GB5_label_无限位返回距离.Text = "retValue";
            GB5_label_无限位回零模式.Text = "HomeMode";
            GB5_label_无限位回零电流.Text = "HomeMa";
            GB5_label_限位重映射.Location = new Point(510, 152);
            GB5_label_限位重映射.Text = "Limit remap";
            GB5_label_EN回零与位置保护.Font = new Font("宋体", 10.5F);
            GB5_label_EN回零与位置保护.Location = new Point(16, 185);
            GB5_label_EN回零与位置保护.Text = "EN 0 and\r\nPosition\r\nprotect";
            GB5_label_EN回零.Text = "g0Enable";
            GB5_label_位置保护.Text = "Enble";
            GB5_label_触发时间.Text = "Tim";
            GB5_label_触发距离.Text = "Errors";
            GB5_button_单圈回零.Text = "Send";
            GB5_button_限位参数.Text = "Send";
            GB5_button_读取IO端口.Text = "Read IO";
            GB5_button_限位归零.Text = "Go home";
            GB5_button_直接归零.Text = "Axis zero";
            GB5_button_无限位回零.Text = "Send";
            GB5_button_限位重映射.Text = "Send";
            GB5_button_EN回零与位置保护.Text = "Send";
            GB5_button_写IO端口.Text = "Write IO";
            WriteIO_Text = WriteIO_EN;
            GB5_comboBox_OUT2写入.Items.Clear();
            GB5_comboBox_OUT2写入.Items.AddRange(WriteIO_Text);
            GB5_comboBox_OUT1写入.Items.Clear();
            GB5_comboBox_OUT1写入.Items.AddRange(WriteIO_Text);

            F1_groupBox6_数据日志.Text = "Data log";

            Text1_Connect = ConnectText1[1];
            Text1_window = WindowText1[1];
            Text2_window = WindowText2[1];
            Text2_Connect = ConnectText2[1];
            Text1_SerialError = SerialErrorText1[1];
            Text2_SerialError = SerialErrorText2[1];
            Text1_Speedgear = Speedgear_Text1[1];
            Text1_SubdivisionError = SubdivisionError_Text1[1];
            Text1_PulseError = PulseError_Text1[1];
            Text2_PulseError = PulseError_Text2[1];
            Text1_UartAddrError = UartAddrError_Text1[1];
            Text2_UartAddrError = UartAddrError_Text2[1];
            Text1_DataError = DataError_Text1[1];
            Text_CurrentError42D = CurrentError42D_Text[1];
            Text_CurrentError57D = CurrentError57D_Text[1];
            Text1_EN = EN_Text1[1];
            Text2_EN = EN_Text2[1];
            Text1_Zero = Zero_Text1[1];
            Text2_Zero = Zero_Text2[1];
            Text3_Zero = Zero_Text3[1];
            Text2_AutoZero = AutoZero_Text2[1];
            Text3_AutoZero = AutoZero_Text3[1];
            Text1_Block = Block_Text1[1];
            Text2_Block = Block_Text2[1];
            Text1_Stall = Stall_Text1[1];
            Text2_Stall = Stall_Text2[1];
            Text1_General = General_Text1[1];
            Text2_General = General_Text2[1];
            Text1_Dir = Dir_Text1[1];
            Text2_Dir = Dir_Text2[1];
            Text3_Dir = Dir_Text3[1];
            Text1_Move = Move_Text1[1];
            Text2_Move = Move_Text2[1];
            Text3_Move = Move_Text3[1];
            Text4_Move = Move_Text4[1];
            Text5_Move = Move_Text5[1];
            Text1_Stop = Stop_Text1[1];
            Text2_Stop = Stop_Text2[1];
            Text3_Stop = Stop_Text3[1];
            Text4_Stop = Stop_Text4[1];
            Text1_COM = COM_Text1[1];
            Text1_Cal = Cal_Text1[1];
            Text2_Cal = Cal_Text2[1];
            Text3_Cal = Cal_Text3[1];
            Text1_RX = RX_Text1[1];
            Text2_RX = RX_Text2[1];
            Text1_Read = Read_Text1[1];
            Text2_Read = Read_Text2[1];
            Text_HardVer = HardVer_Text[1];
            Text_FirmVer = FirmVer_Text[1];
            Text1_AxisError = AxisError_Text1[1];
            Stop1_Emergency = Emergency_Stop1[1];
            Stop2_Emergency = Emergency_Stop2[1];
            Restart1_Motor = Motor_Restart1[1];
            Restart2_Motor = Motor_Restart2[1];
        }
    }
}