import {
  CacheType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  User,
} from "discord.js";
import { Command } from "../command";
import { AstraLuna } from "../Client";
import { BEmbed } from "../components/discord/Embed";
import { RepCollection, BlacklistCollection } from "../schematicas/Schematica";

class Reputation implements Command {
  public data: SlashCommandBuilder = new SlashCommandBuilder();
  public softbannedUsers = new Map();
  public interaction: ChatInputCommandInteraction | null = null;
  public client: AstraLuna | null = null;
  private comment: string | null = null;
  private user: User | null = null;

  constructor() {
    this.data
      .setName("reputação")
      .setDescription("► De uma reputação...")
      .addSubcommand((sub) =>
        sub
          .setName("ajuda")
          .setDescription("► Caso você não entenda como funciona...")
      )
      .addSubcommand((sub) =>
        sub
          .setName("remover")
          .setDescription("► Adicione pontos negativos para um usuário...")
          .addUserOption((usr) =>
            usr
              .setName("usuário")
              .setDescription("► Usuário...")
              .setRequired(true)
          )
          .addStringOption((string) =>
            string
              .setName("comentário")
              .setDescription("► Comentário..?")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("blacklist")
          .setDescription("► Dê um shadowban em um usuário malandro!")
          .addUserOption((s) =>
            s
              .setName("usuário")
              .setDescription("► Usuário para entrar na blacklist")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("whitelist")
          .setDescription("► Remova usuários da blacklist do seu servidor!")
          .addUserOption((s) =>
            s
              .setName("usuário")
              .setDescription("► Usuário para remover da blacklist")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("adicionar")
          .setDescription("► Adicione pontos positivos para um usuário...")
          .addUserOption((usr) =>
            usr
              .setName("usuário")
              .setDescription("► Usuário...")
              .setRequired(true)
          )
          .addStringOption((string) =>
            string
              .setName("comentário")
              .setDescription("► Comentário..?")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("ver")
          .setDescription("► Veja uma lista de comentários sobre um usuário...")
          .addUserOption((usr) =>
            usr
              .setName("usuário")
              .setDescription("► Usuário...")
              .setRequired(true)
          )
      );
  }

  setClient(client: AstraLuna) {
    this.client = client;
    return this;
  }

  setInteraction(interaction: ChatInputCommandInteraction<CacheType>) {
    this.interaction = interaction;
    return this;
  }

  permissionCheck() {
    if (!this.interaction || !this.client)
      return console.error("INTERACTION/CLIENT IS NOT DEFINED.");

    const Guild = this.client.guilds.cache.get(this.interaction.guildId ?? "");
    const User = Guild?.members.cache.get(this.interaction.user.id);
    if (!User?.permissions.has(PermissionFlagsBits.Administrator)) return false;
    return true;
  }

  setMisc() {
    if (!this.interaction || !this.client)
      return console.error("INTERACTION/CLIENT IS NOT DEFINED.");

    this.comment = this.interaction.options.getString("comentário");
    this.user = this.interaction.options.getUser("usuário");
  }

  async ajuda() {
    if (!this.interaction || !this.client)
      return console.error("INTERACTION/CLIENT IS NOT DEFINED.");

    return this.interaction.reply({
      ephemeral: true,
      embeds: [
        new BEmbed()
          .setAuthor({ name: "Seção de ajuda" })
          .setDescription(
            "O sistema de reputação foi feito com a intenção de ajudar pessoas que vendem/trocam items dentro do servidor a passar maior confiança para o outro usuário."
          )
          .addFields(
            {
              name: "O sistema de comentários",
              value:
                "O sistema de comentários tem foco em deixar um feedback sobre a venda/troca para outros usuários.\n",
            },
            {
              name: 'O sistema de "Anti-Rep Bombing"',
              value:
                "Para ter um melhor equilíbrio entre as reputações, usuários que derem 3 pontos de reputação negativa em menos uma hora serão punidos automaticamente.\n",
            },
            {
              name: "O sistema de Fator de Confiança",
              value:
                "Todo usuário tem uma porcentagem% de confiança, caso tenha mais pontos de reputação ruins do que boas, essa porcentagem cai, caso contrário, sobe.\nQuando um usuário tem uma porcentagem% de reputação muito baixa, um aviso óbvio será emitido ao lado de sua porcentagem% de confiança.\n",
            },
            {
              name: "/reputação adicionar <usuário> (Slash Command)",
              value:
                "Esse comando é utilizado para adicionar pontos de reputação para um usuário",
            },
            {
              name: "/reputação remover <usuário> (Slash Command)",
              value:
                "Esse comando é utilizado para remover pontos de reputação para um usuário",
            },
            {
              name: "/reputação comentários <usuário> (Slash Command)",
              value:
                "Esse comando é utilizado para ver informações de reputação para um usuário",
            }
          )
          .setColor("Blurple")
          .setThumbnail(this.interaction.user.avatarURL()),
      ],
    });
  }

  async blacklist() {
    if (!this.interaction || !this.client)
      return console.error("INTERACTION/CLIENT IS NOT DEFINED.");
    await this.interaction.deferReply();

    const hasPermissions = this.permissionCheck();
    if (!hasPermissions)
      return this.interaction.editReply({
        content: "Você não tem permissão para isso.",
      });

    const usuário = this.interaction.options.getUser("usuário");
    await BlacklistCollection.create({
      userId: usuário?.id,
      GuildId: this.interaction.guildId,
    });
    return await this.interaction.editReply({
      content: `O usuário ${
        usuário?.globalName ? usuário.globalName : usuário?.username
      } foi adicionado na lista negra!`,
    });
  }

  async whitelist() {
    if (!this.interaction || !this.client)
      return console.error("INTERACTION/CLIENT IS NOT DEFINED.");

    const hasPermissions = this.permissionCheck();
    if (!hasPermissions)
      return this.interaction.editReply({
        content: "Você não tem permissão para isso.",
      });

    const searchBan = await BlacklistCollection.findOne({
      userId: this.user?.id,
      GuildId: this.interaction.guildId,
    });
    if (!searchBan)
      return await this.interaction.editReply({
        content: "Esse usuário não está na blacklist!",
      });
    if (searchBan) {
      await BlacklistCollection.deleteOne({
        userId: this.user?.id,
        GuildId: this.interaction.guildId,
      });
      return await this.interaction.editReply({
        content: "Usuário desbanido com sucesso.",
      });
    }

    const shadowban = await BlacklistCollection.findOne({
      GuildId: this.interaction.guildId,
      userId: this.interaction.user.id,
    });
    if (shadowban)
      return await this.interaction.editReply({
        content:
          "[❌] Você está permanentemente banido de usar o sistema de reputações.",
      });
    if (
      this.softbannedUsers.has(this.interaction.user.id) &&
      this.softbannedUsers.get(this.interaction.user.id) > Date.now()
    ) {
      const remainingTime = Math.ceil(
        (this.softbannedUsers.get(this.interaction.user.id) - Date.now()) / 1000
      );
      return await this.interaction.editReply({
        content: `[❌] Você está sendo limitado de usar o sistema de Reputação. Aguarde ${remainingTime} segundos.`,
      });
    }
  }

  validateOperation() {
    if (this.user?.id === this.interaction?.user.id) return false;

    if (this.user?.bot) return false;

    return true;
  }

  async adicionar() {
    if (!this.interaction || !this.client)
      return console.error("INTERACTION/CLIENT IS NOT DEFINED.");

    await this.interaction.deferReply();

    const validate = this.validateOperation();
    if (!validate)
      return this.interaction.editReply({ content: "Operação inválida." });

    await RepCollection.findOneAndUpdate(
      { UserId: this.user?.id },
      {
        $push: {
          Comments: {
            $each: [
              {
                userId: this.interaction.user.id,
                comment: this.comment,
                createdAt: new Date(),
                isPositive: true,
              },
            ],
            $sort: {
              createdAt: -1,
            },
          },
        },
        $inc: {
          goodRep: 1,
        },
      },
      { upsert: true }
    );

    const embed = new BEmbed()
      .setAuthor({
        name: `${this.user?.globalName}🤝${this.interaction.user.globalName}`,
      })
      .setDescription(
        `**🤑 | REPUTAÇÃO ADICIONADA!**\n${this.user?.globalName} recebeu um ponto de reputação de ${this.interaction.user.globalName}.\n${this.interaction.user.globalName} comentou: "${this.comment}"`
      )
      .setColor("Green");

    await this.interaction.editReply({
      embeds: [embed],
      content: `<@${this.user?.id}>`,
    });
  }

  async remover() {
    if (!this.interaction || !this.client)
      return console.error("INTERACTION/CLIENT IS NOT DEFINED.");

    await this.interaction.deferReply();

    const validate = this.validateOperation();
    if (!validate)
      return this.interaction.editReply({ content: "Operação inválida." });

    const currentTimestamp = Date.now();
    const index = await RepCollection.findOne({ UserId: this.user?.id });
    if (!index) return;

    const negativeReviews = index.Comments.filter(
      (comment: { isPositive: boolean; createdAt: number; userId: string }) =>
        !comment.isPositive &&
        comment.userId === this.interaction?.user.id &&
        comment.createdAt >= currentTimestamp - 3600000 &&
        comment.createdAt <= currentTimestamp
    );
    if (negativeReviews.length >= 2) {
      const softbanExpiration = Date.now() + 3600000;
      if (!this.softbannedUsers.has(this.interaction.user.id))
        this.softbannedUsers.set(this.interaction.user.id, softbanExpiration);
    }

    await RepCollection.findOneAndUpdate(
      { UserId: this.user?.id },
      {
        $push: {
          Comments: {
            $each: [
              {
                userId: this.interaction.user.id,
                comment: this.comment,
                createdAt: new Date(),
                isPositive: false,
              },
            ],
            $sort: {
              createdAt: -1,
            },
          },
        },
        $inc: {
          badRep: 1,
        },
      },
      { upsert: true }
    );

    const embed = new BEmbed()
      .setAuthor({
        name: `${this.user?.globalName}🖕${this.interaction.user.globalName}`,
      })
      .setDescription(
        `**💸 | REPUTAÇÃO REMOVIDA!**\n$${this.interaction.user.globalName} removeu um ponto de reputação de ${this.user?.globalName}.\n${this.interaction.user.globalName} comentou: "${this.comment}"`
      )
      .setColor("Red");

    await this.interaction.editReply({
      embeds: [embed],
      content: `<@${this.user?.id}>`,
    });
  }

  async comentarios() {
    if (!this.interaction || !this.client)
      return console.error("INTERACTION/CLIENT IS NOT DEFINED.");

    await this.interaction.deferReply();

    const validate = this.validateOperation();
    if (!validate)
      return this.interaction.editReply({ content: "Operação inválida." });
    const index = await RepCollection.findOne({ UserId: this.user?.id });
    if (!index) {
      return this.interaction.editReply({
        content: "[❌] Este usuário não tem reputação alguma.",
      });
    }

    const trustPercentage =
      (index.goodRep / (index.goodRep + index.badRep)) * 100;

    const confidenceLevels = [
      { range: [0, 20], level: "⚠️ Muito Baixa ⚠️" },
      { range: [21, 40], level: "⚠️ Baixa" },
      { range: [41, 60], level: "Moderada" },
      { range: [61, 80], level: "Alta" },
      { range: [81, 100], level: "Muito Alta" },
    ];

    const trustLevel = confidenceLevels.find((level) => {
      const [min, max] = level.range;
      return trustPercentage >= min && trustPercentage <= max;
    });

    const embed = new BEmbed()
      .setAuthor({ name: this.user?.globalName ?? "Sem nick" })
      .setDescription(
        `✅ ${index.goodRep} Reputações boa(s)\n❌ ${
          index.badRep
        } Reputações ruim(s)\n📜 ${
          index.Comments.length
        } comentário(s)\n❓ ${trustPercentage.toFixed(
          2
        )}% (${trustLevel?.level}).`
      )
      .setColor("Blurple");

    for (const comment of index.Comments.slice(0, 5)) {
      const fetchUser = await this.interaction.client?.users.fetch(
        comment.userId
      );

      embed.addFields({
        name: fetchUser?.globalName ?? "Sem nick",
        value: `> \`${comment.isPositive ? "✅" : "❌"} ${comment.comment}\``,
        inline: true,
      });
    }

    await this.interaction.editReply({ embeds: [embed] });
  }

  async execute() {
    if (!this.interaction || !this.client)
      return console.error("INTERACTION/CLIENT IS NOT DEFINED.");

    this.setMisc();

    switch (this.interaction.options.getSubcommand()) {
      case "ajuda":
        await this.ajuda();
        break;
      case "blacklist":
        await this.blacklist();
        break;
      case "whitelist":
        await this.whitelist();
        break;
      case "adicionar":
        await this.adicionar();
        break;
      case "remover":
        await this.remover();
        break;
      case "ver":
        await this.comentarios();
        break;
    }
  }
}

export default new Reputation();
