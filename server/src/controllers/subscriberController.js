const crypto = require("crypto");
const { Subscriber, Organization } = require("../models");

const subscribe = async (req, res) => {
  try {
    const { slug } = req.params;
    const { email } = req.body;

    const org = await Organization.findOne({ where: { slug } });
    if (!org) {
      return res.status(404).json({ error: "Status page not found" });
    }

    const existing = await Subscriber.findOne({
      where: { organizationId: org.id, email },
    });

    if (existing) {
      return res.status(400).json({ error: "Already subscribed" });
    }

    const confirmToken = crypto.randomBytes(32).toString("hex");

    await Subscriber.create({
      organizationId: org.id,
      email,
      confirmToken,
      confirmed: true,
    });

    res.status(201).json({ message: "Subscribed successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const unsubscribe = async (req, res) => {
  try {
    const { token } = req.params;

    const subscriber = await Subscriber.findOne({
      where: { confirmToken: token },
    });

    if (!subscriber) {
      return res.status(404).json({ error: "Subscriber not found" });
    }

    await subscriber.destroy();
    res.json({ message: "Unsubscribed successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getSubscribers = async (req, res) => {
  try {
    const subscribers = await Subscriber.findAll({
      where: { organizationId: req.user.organizationId },
      order: [["createdAt", "DESC"]],
    });
    res.json({ subscribers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { subscribe, unsubscribe, getSubscribers };