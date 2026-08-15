import type {
  PaymentMethod,
  PaymentMethodInput,
  PaymentMethodUpdate,
} from "@/types/payment-method";

export type PaymentMethodRepository = {
  list(includeInactive: boolean): Promise<PaymentMethod[]>;
  findById(id: string): Promise<PaymentMethod | null>;
  create(actorId: string, input: PaymentMethodInput): Promise<PaymentMethod>;
  update(
    actorId: string,
    id: string,
    input: PaymentMethodUpdate,
  ): Promise<PaymentMethod | null>;
  remove(actorId: string, id: string): Promise<string | null>;
};

export type PaymentMethodServiceDependencies = {
  methods: PaymentMethodRepository;
};
