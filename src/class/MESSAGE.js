import { XMLParser } from "fast-xml-parser";
import { say, revoke, forward, quote } from '@/action/common.js';
import { getContact, find } from '@/action/contact'
import { getRoomInfo } from '@/action/room'
import { toFileBox } from '@/action/file'
import { Filebox } from '@/class/FILEBOX'
import { MessageType } from '@/type/MessageType'



// 消息类
export class Message {
  constructor(data) {
    // 从 JSON 数据结构中提取所需信息
    this.fromId = data.Data.FromUserName.string
    this.toId = data.Data.ToUserName.string
    this.isRoom = data.Data.FromUserName.string.endsWith('@chatroom')
    this._msgId = data.Data.MsgId || null;
    this._newMsgId = data.Data.NewMsgId || null;
    this._text = data.Data.Content.string || '';
    this._type = data.Data.MsgType;
    this._createTime = data.Data.CreateTime; // 原始的 CreateTime
    this._date = this._createTime * 1000; // 转换时间戳为 Date
    this._self = data.Wxid === data.Data.FromUserName.string; // 判断是否为自己发的消息
    this._pushContent = data.Data.PushContent || '';
    this._msgSeq = data.Data.MsgSeq || null;
    this._status = data.Data.Status || null;
    this._msgSource = data.Data.MsgSource || null;
    if (this.isRoom) { // 执行一次 自动插入房间数据
      getRoomInfo(this.fromId)
    }
  }
  // 静态属性
  static Type = MessageType
  // 实例方法
  isCompanyMsg () { // 是否是企业微信消息
    const companyList = ['weixin', 'newsapp', 'tmessage', 'qqmail', 'mphelper', 'qqsafe', 'weibo', 'qmessage', 'floatbottle', 'medianote']
    return this.fromId.includes('gh_') || companyList.includes(this.fromId)
  }
  from () { // 发送者
    if (this.isRoom) {
      return getContact(this._text.split(':\n')[0])
    }
    return getContact(this.fromId);
  }
  talker () {
    if (this.isRoom) {
      return getContact(this._text.split(':\n')[0])
    }
    return getContact(this.fromId);
  }

  to () { // 接收者
    return getContact(this.toId);
  }

  async room () { // 是否是群聊消息 是则返回群信息
    if (this.isRoom) {
      return await getRoomInfo(this.fromId)
    } else {
      return Promise.resolve(false)
    }
  }

  text () { // 消息内容
    if (this.fromId.endsWith('@chatroom')) {
      return this._text.split(':\n').slice(1).join(':\n')
    }
    return this._text;
  }

  async say (textOrContactOrFileOrUrl) { // 回复消息
    const res = await say(textOrContactOrFileOrUrl, this.fromId)
    return new ResponseMsg(res)
  }

  type () { // 消息类型
    return Message.getType(this._type, this.text())
  }

  self () { // 是否是自己发的消息
    return this._self;
  }

  async mention () { // 获取@的联系人 ..todo
    return new Promise((resolve) => {
      // 根据消息内容模拟提到的联系人
      console.log('暂不支持')
      resolve(null);
    });
  }

  async mentionSelf () { // 是否被@了

    if (this.isRoom && this._msgSource) {
      const parser = new XMLParser({
        ignoreAttributes: false,
        parseAttributeValue: true,
        trimValues: true
      });
      const result = parser.parse(this._msgSource);
      if (result.msgsource?.atuserlist) {
        const atUserList = result.msgsource.atuserlist;
        if (Array.isArray(atUserList) && atUserList.includes(this.Wxid)) {
          return true;
        }
      }
    }
    return false;
  }

  async forward (to) { // 消息转发
    if (!to) {
      console.error('转发消息时，接收者不能为空')
      return
    }
    return forward(this.text(), to, this.type())
  }

  date () {
    return new Date(this._date);
  }

  age () {
    const now = new Date();
    return Math.floor((now - this._date) / 1000); // 以秒为单位计算消息的年龄
  }

  async toContact () { // 获取名片 。。。todo
    return new Promise((resolve) => {
      console.log('暂不支持')
      resolve(null);
    });
  }

  async toUrlLink () { // 获取链接。。。todo
    return new Promise((resolve) => {
      console.log('暂不支持')
      resolve(null);
    });
  }

  async toFileBox (type = 2) { // 获取链接。。。todo
    if (this._type !== 3) {
      console.log('不是图片类型，无法调用toFileBox方法')
      return null
    }
    return new Promise((resolve) => {
      let xml = ''
      if (this.isRoom) {
        xml = this._text.split(":\n")[1]
      } else {
        xml = this._text
      }
      toFileBox(xml, type).then((url) => {
        resolve(Filebox.toDownload(url))
      }).catch(e => {
        console.error(e)
        resolve(null)
      })
    });
  }
  async toFilebox (type = 2) {
    return this.toFileBox(type)
  }
  async quote (title) { // 引用消息
    if (title === '') {
      console.error('引用消息时title不能为空')
      return
    }

    let msg = {
      title,
      msgid: this._newMsgId,
      wxid: this.fromId
    }
    if (this.isRoom) {
      msg.wxid = this._text.split(':\n')[0]
    }
    return quote(msg, this.fromId)
  }
  getXml2Json (xml) {
    const parser = new XMLParser({
      ignoreAttributes: false, // 不忽略属性
      attributeNamePrefix: '', // 移除默认的属性前缀
    });
    let jObj = parser.parse(xml);
    return jObj
  }
  // 静态方法
  static async find (query) {
    return await find(query)
  }

  static async findAll (queryArgs) {
    console.log('暂不支持findAll')
    return Promise.resolve([])
  }

  static getType (type, xml) {
    let parser, jObj
    try {
      switch (type) {
        case 1:
          return MessageType.Text
        case 3:
          return MessageType.Image
        case 34:
          return MessageType.Voice
        case 37:
          return MessageType.AddFriend
        case 42:
          return MessageType.Contact
        case 43:
          return MessageType.Video
        case 47:
          return MessageType.Emoji
        case 48:
          return MessageType.Location
        case 49:
          parser = new XMLParser({
            ignoreAttributes: false, // 不忽略属性
            attributeNamePrefix: '', // 移除默认的属性前缀
          });
          jObj = parser.parse(xml);
          // console.log(jObj)
          if (jObj.msg.appmsg.type === 5) {
            if (jObj.msg.appmsg.title === '邀请你加入群聊') {
              return MessageType.RoomInvitation
            } else { // 公众号链接
              return MessageType.Link
            }
          } else if (jObj.msg.appmsg.type === 6) {
            return MessageType.File
          } else if (jObj.msg.appmsg.type === 17) {
            return MessageType.RealTimeLocation
          } else if (jObj.msg.appmsg.type === 19) {
            return MessageType.ChatHistroy
          } else if (jObj.msg.appmsg.type === 33 || jObj.msg.appmsg.type === 36) {
            return MessageType.MiniApp
          } else if (jObj.msg.appmsg.type === 51) {
            return MessageType.VideoAccount
          } else if (jObj.msg.appmsg.type === 57) {
            return MessageType.Quote
          } else if (jObj.msg.appmsg.type === 74) {
            return MessageType.FileStart
          } else if (jObj.msg.appmsg.type === 2000) {
            return MessageType.Transfer
          } else if (jObj.msg.appmsg.type === 2001) {
            return MessageType.RedPacket
          }
        case 50:
        //VOIP挂断
        case 51:
          //状态通知
          parser = new XMLParser({
            ignoreAttributes: false, // 不忽略属性
            attributeNamePrefix: '', // 移除默认的属性前缀
          });
          jObj = parser.parse(xml);
          if (jObj.msg.name === 'MomentsTimelineStatus') {
            //新的朋友圈消息
          } else if (jObj.msg.name === 'lastMessage') {
            //群聊消息
          }
        case 56:
        //语音群聊
        case 10000:
        //系统消息
        case 10002:
          parser = new XMLParser({
            ignoreAttributes: false, // 不忽略属性
            attributeNamePrefix: '', // 移除默认的属性前缀
          });
          jObj = parser.parse(xml);
          if (jObj.sysmsg.type === 'revokemsg') {
            return MessageType.Revoke
          } else if (jObj.sysmsg.type === 'pat') {
            return MessageType.Pat
          } else if (jObj.sysmsg.type === 'functionmsg') {
            return MessageType.FunctionMsg
          } else if (jObj.sysmsg.type === 'ilinkvoip') {
            //voip邀请
            return MessageType.Voip
          } else if (jObj.sysmsg.type === 'trackmsg') {
            //实时位置更新
          }
        default:
          return MessageType.Unknown
      }
    } catch (e) {
      return MessageType.Unknown
    }


  }

}

export class ResponseMsg {
  constructor(obj) {
    Object.assign(this, obj);
  }
  revoke () {
    return revoke(this)
  }
}
